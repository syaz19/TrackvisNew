import { useState, useEffect } from "react";

import {
  doc,
  collection,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  updateDoc
} from "firebase/firestore";

import { db } from "../../firebase";
import { useSecurityAlert } from "../../layouts/SecurityAlertContext";


const initialFormState = {
  name: "",
  purpose: "",
  nonSchoolPurpose: "",
  schoolPurpose: "",
  destinations: [],
  location: "Entrance",
  duration: "",
  durationUnit: "minutes",
  uid: ""
};


const personalDestinations = [
  "SCC Gymnasium",
  "Elementary Building",
  "High School Building",
  "High School Faculty",
  "IT Building",
  "Education Building",
  "Criminology Building",
  "CABA Building",
  "Waiting/Bench Area",
  "Canteen",
  "Forum Hall",
  "Sport Office"
];


function parseDurationInput(rawDuration) {
  if (typeof rawDuration !== "string") {
    return null;
  }

  const value = rawDuration.trim().toLowerCase();

  if (!value) {
    return null;
  }

  const implicitCompositeMatch = value.match(
    /^(\d+(?:\.\d+)?)\s*(?:and|,)\s*(\d+(?:\.\d+)?)$/
  );

  if (implicitCompositeMatch) {
    const hours = Number(implicitCompositeMatch[1]);
    const minutes = Number(implicitCompositeMatch[2]);

    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes) ||
      hours <= 0 ||
      minutes < 0
    ) {
      return null;
    }

    return {
      durationValue: hours * 60 + minutes,
      durationUnit: "minutes"
    };
  }

  const normalizedValue = value
    .replace(/\s+and\s+/gi, " ")
    .replace(/\s*,\s*/g, " ");

  const durationPattern =
    /(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|sec|min|hr|s|m|h)?/gi;

  const matches = [];

  let match;

  while ((match = durationPattern.exec(normalizedValue)) !== null) {
    if (match[0].trim() === "") {
      continue;
    }

    matches.push(match);

    if (match[0].length === 0) {
      break;
    }
  }

  if (!matches.length) {
    const bareNumber = Number(value);

    if (!Number.isFinite(bareNumber) || bareNumber <= 0) {
      return null;
    }

    return {
      durationValue: bareNumber,
      durationUnit: "minutes"
    };
  }

  let totalSeconds = 0;

  for (const item of matches) {
    const quantity = Number(item[1]);
    const unitToken = (item[2] || "minutes").toLowerCase();

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return null;
    }

    let unit = "minutes";

    if (
      ["sec", "secs", "second", "seconds", "s"].includes(unitToken)
    ) {
      unit = "seconds";
    } else if (
      ["min", "mins", "minute", "minutes", "m"].includes(unitToken)
    ) {
      unit = "minutes";
    } else if (
      ["hr", "hrs", "hour", "hours", "h"].includes(unitToken)
    ) {
      unit = "hours";
    }

    totalSeconds +=
      quantity *
      {
        seconds: 1,
        minutes: 60,
        hours: 3600
      }[unit];
  }

  if (totalSeconds >= 60) {
    return {
      durationValue: totalSeconds / 60,
      durationUnit: "minutes"
    };
  }

  return {
    durationValue: totalSeconds,
    durationUnit: "seconds"
  };
}


export default function RegisterVisitor() {

  const [form, setForm] = useState(initialFormState);
  const [activeTagIds, setActiveTagIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [waitingForRFID, setWaitingForRFID] = useState(true);

  const { pushSecurityAlert: onSecurityAlert } = useSecurityAlert();


  function showAlert(text) {
    onSecurityAlert({
      id: `register_${Date.now()}_${Math.random()}`,
      text,
      type: "register"
    });
  }


  function handleChange(event) {

    const { name, value } = event.target;

    const nextForm = {
      ...form,
      [name]: value
    };

    if (name === "purpose" && value !== "School Related") {
      nextForm.schoolPurpose = "";
    }

    if (
      name === "purpose" &&
      value !== "Personal / Non-School Related"
    ) {
      nextForm.nonSchoolPurpose = "";
    }

    if (name === "purpose") {
      nextForm.destinations = [];
    }

    if (name === "destinations") {
      nextForm.destinations = Array.from(
        event.target.selectedOptions,
        function (option) {
          return option.value;
        }
      );
    }

    setForm(nextForm);
  }


  function resetForm() {
    setForm(initialFormState);
    setWaitingForRFID(true);
  }


  /*
   * RFID REGISTRATION LISTENER
   *
   * The Entrance reader sends an unregistered EPC
   * to the scanRFID Cloud Function.
   *
   * scanRFID saves that EPC to:
   *
   * rfid_registration/latest
   *
   * This listener receives the EPC and automatically
   * puts it into form.uid.
   */

  useEffect(function () {

    const registrationRef = doc(
      db,
      "rfid_registration",
      "latest"
    );

    const unsubscribe = onSnapshot(
      registrationRef,
      function (snapshot) {

        if (!snapshot.exists()) {
          return;
        }

        const data = snapshot.data();

        if (!data.epc) {
          return;
        }

        if (data.location !== "Entrance") {
          return;
        }

        setForm(function (current) {

          if (current.uid === data.epc) {
            return current;
          }

          return {
            ...current,
            uid: data.epc,
            location: "Entrance"
          };
        });

        setWaitingForRFID(false);
      },
      function (error) {
        console.error(
          "Failed to listen for RFID registration scan:",
          error
        );
      }
    );

    return function () {
      unsubscribe();
    };

  }, []);


  /*
   * ACTIVE RFID ASSIGNMENTS
   *
   * This is still used to make sure that the scanned
   * RFID is not already assigned to another active visitor.
   */

  useEffect(function () {

    const unsubscribe = onSnapshot(
      query(
        collection(db, "visitors"),
        where("status", "==", "active")
      ),
      function (snapshot) {

        setActiveTagIds(
          new Set(
            snapshot.docs
              .map(function (item) {
                return item.data().uid;
              })
              .filter(Boolean)
          )
        );

      },
      function (error) {

        console.error(
          "Failed to load active RFID assignments:",
          error
        );

        setActiveTagIds(new Set());
      }
    );

    return function () {
      unsubscribe();
    };

  }, []);


  async function handleSubmit(event) {

    event.preventDefault();


    if (!form.purpose) {
      showAlert("Please complete all required fields.");
      return;
    }


    if (!form.destinations.length) {
      showAlert("Please complete all required fields.");
      return;
    }


    if (
      form.purpose === "School Related" &&
      !form.schoolPurpose.trim()
    ) {
      showAlert(
        "Please enter the specific school-related purpose."
      );
      return;
    }


    if (
      form.purpose === "Personal / Non-School Related" &&
      !form.nonSchoolPurpose.trim()
    ) {
      showAlert("Please enter the specific purpose.");
      return;
    }


    if (
      !form.name ||
      !form.location ||
      !form.duration
    ) {
      showAlert("Please complete all required fields.");
      return;
    }


    const parsedDuration = parseDurationInput(form.duration);

    if (!parsedDuration) {
      showAlert(
        "Please enter a valid duration such as 10 seconds, 30 minutes, or 1 hour 30 minutes."
      );
      return;
    }


    const {
      durationValue,
      durationUnit
    } = parsedDuration;


    setLoading(true);


    try {

      /*
       * RFID EPC is now automatically received
       * from the Entrance reader.
       */

      const selectedUid = form.uid.trim();


      if (!selectedUid) {
        showAlert(
          "Please scan an RFID tag at the Entrance."
        );

        setLoading(false);
        return;
      }


      /*
       * Check if the scanned RFID is already assigned
       * to an active visitor.
       */

      const isTagAvailable =
        !activeTagIds.has(selectedUid);


      if (!isTagAvailable) {
        showAlert(
          "This RFID tag is currently in use. Please scan another tag."
        );

        setLoading(false);
        return;
      }


      /*
       * Double-check Firestore directly.
       */

      const sameUidQuery = query(
        collection(db, "visitors"),
        where("uid", "==", selectedUid),
        where("status", "==", "active")
      );


      const sameUidSnapshot =
        await getDocs(sameUidQuery);


      if (!sameUidSnapshot.empty) {
        showAlert(
          "This RFID tag is already assigned to an active visitor."
        );

        setLoading(false);
        return;
      }


      const startTime = Date.now();


      const durationMultipliers = {
        seconds: 1000,
        minutes: 60000,
        hours: 3600000
      };


      const endTime =
        startTime +
        durationValue *
          durationMultipliers[durationUnit];


      const visitorDocId =
        `${selectedUid}_${startTime}`;


      const visitorRef = doc(
        db,
        "visitors",
        visitorDocId
      );


      /*
       * Non-School Related:
       * Not Required
       *
       * School Related:
       * Pending
       */

      const confirmStatusValue =
        form.purpose ===
        "Personal / Non-School Related"
          ? "Not Required"
          : "Pending";


      const destinationConfirmations =
        form.destinations.map(function (destination) {

          return {
            destination,
            status: confirmStatusValue,
            confirmedAt: null,
            confirmedBy: null
          };

        });


      await setDoc(visitorRef, {

        name: form.name,

        purpose: form.purpose,

        specificPurpose:
          form.purpose === "School Related"
            ? form.schoolPurpose.trim()
            : form.nonSchoolPurpose.trim(),

        schoolPurpose:
          form.purpose === "School Related"
            ? form.schoolPurpose.trim()
            : "",

        nonSchoolPurpose:
          form.purpose ===
          "Personal / Non-School Related"
            ? form.nonSchoolPurpose.trim()
            : "",

        destination:
          form.destinations.join(", "),

        destinations:
          form.destinations,

        location:
          form.location || "Entrance",

        currentLocation:
          "Entrance",

        duration:
          durationValue,

        durationText:
          form.duration.trim(),

        durationUnit,

        /*
         * This is the EPC automatically received
         * from the Entrance RFID reader.
         */

        uid:
          selectedUid,

        startTime,

        endTime,

        timeIn:
          startTime,

        timeOut:
          null,

        status:
          "active",

        completionStatus:
          "Active",

        confirmStatus:
          confirmStatusValue,

        /*
         * Destination confirmations exist ONLY
         * for School Related visitors.
         */

        ...(form.purpose === "School Related"
          ? {
              destinationConfirmations
            }
          : {}),

        violationType:
          "",

        confirmedAt:
          null,

        confirmedBy:
          null,

        officeEntryAlerted:
          false

      });


      /*
       * Update RFID tag record.
       *
       * If the RFID tag already exists in rfid_tags,
       * its status will be updated.
       */

      try {

        await updateDoc(
          doc(db, "rfid_tags", selectedUid),
          {
            Status: "In Use",
            UsedBy: form.name || "",
            currentVisitorId: visitorRef.id,
            assignedAt: startTime
          }
        );

      } catch (error) {

        console.warn(
          "Failed to update RFID tag status:",
          error
        );

      }


      /*
       * Clear the latest registration scan after
       * successful registration.
       */

      try {

        await setDoc(
          doc(
            db,
            "rfid_registration",
            "latest"
          ),
          {
            epc: "",
            location: "",
            timestamp: Date.now()
          },
          {
            merge: true
          }
        );

      } catch (error) {

        console.warn(
          "Failed to clear RFID registration scan:",
          error
        );

      }


      showAlert(
        "Visitor Registered Successfully!"
      );


      resetForm();


    } catch (error) {

      console.error(error);

      showAlert(error.message);

    }


    setLoading(false);
  }


  return (
    <div>

      <h1>Register Visitor</h1>


      <form
        className="form-card"
        onSubmit={handleSubmit}
      >

        {/* VISITOR NAME */}

        <input
          className="form-control"
          name="name"
          placeholder="Visitor Name"
          value={form.name}
          onChange={handleChange}
        />

        <br />
        <br />


        {/* PURPOSE */}

        <div className="form-control purpose-section">

          <label className="purpose-row">

            <input
              className="purpose-type"
              type="radio"
              name="purpose"
              value="Personal / Non-School Related"
              checked={
                form.purpose ===
                "Personal / Non-School Related"
              }
              onChange={handleChange}
            />

            <span className="purpose-label">
              Non-School Related:
            </span>

            <input
              className="form-control purpose-input"
              name="nonSchoolPurpose"
              placeholder="Specific purpose"
              value={form.nonSchoolPurpose}
              onChange={function (event) {

                handleChange(event);

                setForm(function (current) {

                  return {
                    ...current,
                    purpose:
                      "Personal / Non-School Related"
                  };

                });

              }}
            />

          </label>


          <label className="purpose-row">

            <input
              className="purpose-type"
              type="radio"
              name="purpose"
              value="School Related"
              checked={
                form.purpose ===
                "School Related"
              }
              onChange={handleChange}
            />

            <span className="purpose-label">
              School Related:
            </span>

            <input
              className="form-control purpose-input"
              name="schoolPurpose"
              placeholder="Specific purpose"
              value={form.schoolPurpose}
              onChange={function (event) {

                handleChange(event);

                setForm(function (current) {

                  return {
                    ...current,
                    purpose:
                      "School Related"
                  };

                });

              }}
            />

          </label>

        </div>


        <br />
        <br />


        {/* DESTINATION */}

        <div
          onMouseDown={function () {

            if (!form.purpose) {

              showAlert(
                "Please select a visit type before you can select a destination."
              );

            }

          }}
        >

          <div className="form-control destination-section">

            <div className="destination-heading">
              Destination
            </div>


            {form.purpose && (

              <div className="destination-grid">

                {(
                  form.purpose ===
                  "Personal / Non-School Related"

                    ? personalDestinations

                    : [
                        "Admin",
                        "Registrar",
                        "Guidance",
                        "CABA Dean",
                        "IT Dean",
                        "Criminology Dean",
                        "Education Dean",
                        "Librarian"
                      ]

                ).map(function (destination) {

                  const isSelected =
                    form.destinations.includes(
                      destination
                    );


                  return (

                    <label
                      key={destination}
                      className={`destination-option ${
                        isSelected
                          ? "destination-option--selected"
                          : ""
                      }`}
                    >

                      <input
                        className="destination-checkbox"
                        type="checkbox"
                        checked={isSelected}
                        onChange={function () {

                          setForm(function (current) {

                            const destinations =
                              isSelected

                                ? current.destinations.filter(
                                    function (item) {
                                      return (
                                        item !==
                                        destination
                                      );
                                    }
                                  )

                                : [
                                    ...current.destinations,
                                    destination
                                  ];


                            return {
                              ...current,
                              destinations
                            };

                          });

                        }}
                      />


                      <span className="destination-name">
                        {destination}
                      </span>

                    </label>

                  );

                })}

              </div>

            )}

          </div>

        </div>


        <br />
        <br />


        {/* LOCATION */}

        <input
          className="form-control"
          name="location"
          placeholder="Location (Entrance)"
          value={form.location}
          onChange={handleChange}
        />


        <br />
        <br />


        {/* DURATION */}

        <div className="form-row">

          <input
            className="form-control"
            name="duration"
            type="text"
            placeholder="Duration: e.g. 10 sec, 30 min, 1 hour 30 minutes"
            value={form.duration}
            onChange={handleChange}
          />

        </div>


        <br />
        <br />


        {/* RFID SCAN */}

        <div className="form-control">

          <div
            style={{
              fontWeight: "600",
              marginBottom: "0.5rem"
            }}
          >
            RFID Tag
          </div>


          {!form.uid ? (

            <p
              style={{
                margin: 0,
                color: "#71717A",
                fontSize: "0.95rem"
              }}
            >
              {waitingForRFID
                ? "Waiting for RFID scan at Entrance..."
                : "Please scan an RFID tag at Entrance."}
            </p>

          ) : (

            <p
              style={{
                margin: 0,
                color: "#2563EB",
                fontSize: "0.95rem",
                fontWeight: "600"
              }}
            >
              RFID Tag Scanned: {form.uid}
            </p>

          )}

        </div>


        <br />
        <br />


        {/* REGISTER BUTTON */}

        <button
          className="primary-button"
          type="submit"
          disabled={
            loading ||
            !form.uid
          }
        >
          {loading
            ? "Saving..."
            : "Register Visitor"}
        </button>

      </form>

    </div>
  );
}
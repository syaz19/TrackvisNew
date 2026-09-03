
import { useState, useEffect } from "react";

import { doc, collection, getDocs, onSnapshot, query, setDoc, where, updateDoc } from "firebase/firestore";

import { db } from "../../firebase";


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

const excludedRegistrationTags = new Set([
  "E28069150000502D9DF2EE8A",
  "E28069150000402D9DF3FA89",
  "E28069150000402D9DF3D97D"
]);

function parseDurationInput(rawDuration) {
  if (typeof rawDuration !== "string") {
    return null;
  }

  const value = rawDuration.trim().toLowerCase();

  if (!value) {
    return null;
  }

  const implicitCompositeMatch = value.match(/^(\d+(?:\.\d+)?)\s*(?:and|,)\s*(\d+(?:\.\d+)?)$/);

  if (implicitCompositeMatch) {
    const hours = Number(implicitCompositeMatch[1]);
    const minutes = Number(implicitCompositeMatch[2]);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours <= 0 || minutes < 0) {
      return null;
    }

    return {
      durationValue: hours * 60 + minutes,
      durationUnit: "minutes"
    };
  }

  const normalizedValue = value.replace(/\s+and\s+/gi, " ").replace(/\s*,\s*/g, " ");
  const durationPattern = /(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|sec|min|hr|s|m|h)?/gi;
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

    if (["sec", "secs", "second", "seconds", "s"].includes(unitToken)) {
      unit = "seconds";
    } else if (["min", "mins", "minute", "minutes", "m"].includes(unitToken)) {
      unit = "minutes";
    } else if (["hr", "hrs", "hour", "hours", "h"].includes(unitToken)) {
      unit = "hours";
    }

    totalSeconds += quantity * {
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
  const [tags, setTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [loading, setLoading] = useState(false);


  function handleChange(event) {
    
    const { name, value } = event.target;
   
    const nextForm = { ...form, [name]: value };

    if (name === "purpose" && value !== "School Related") {
      nextForm.schoolPurpose = "";
    }

    if (name === "purpose" && value !== "Personal / Non-School Related") {
      nextForm.nonSchoolPurpose = "";
    }

    if (name === "purpose") {
      nextForm.destinations = [];
    }

    if (name === "destinations") {
      nextForm.destinations = Array.from(event.target.selectedOptions, function (option) {
        return option.value;
      });
    }

  
    setForm(nextForm);
  }

  
  function resetForm() {
    setForm(initialFormState);
  }

  
  function getTagIdentifier(tag) {
    if (tag.epc) return tag.epc;
    if (tag.uid) return tag.uid;
    if (tag.id) return tag.id;
    return "Unknown";
  }

  
  function getTagStatus(tag) {
    const status = tag.Status || tag.status || "";

    if (!status) {
      return "Unknown";
    }

    return status.toString();
  }

  
  

  
  

  
  function isTagAvailable(tag) {
    return getTagStatus(tag).toLowerCase() === "available";
  }

  
  function formatTagLabel(tag) {
    return getTagIdentifier(tag);
  }

  
  useEffect(function () {
   
    const unsubscribe = onSnapshot(
      collection(db, "rfid_tags"),
      function (snapshot) {
        
        const tagList = snapshot.docs.map(function (item) {
          return { id: item.id, epc: item.id, ...item.data() };
        }).filter(function (tag) {
          return !excludedRegistrationTags.has(getTagIdentifier(tag));
        });
        
        setTags(tagList);
        setTagsLoading(false);
      },
      function (error) {
        console.error("Failed to load RFID tags:", error);
        setTagsLoading(false);
      }
    );

    
    return function () {
      unsubscribe();
    };
  }, []);

 
  async function handleSubmit(event) {
    event.preventDefault();

    
    if (!form.purpose) {
      alert("Please complete all required fields.");
      return;
    }

    
    if (!form.destinations.length) {
      alert("Please complete all required fields.");
      return;
    }

    if (form.purpose === "School Related" && !form.schoolPurpose.trim()) {
      alert("Please enter the specific school-related purpose.");
      return;
    }

    if (form.purpose === "Personal / Non-School Related" && !form.nonSchoolPurpose.trim()) {
      alert("Please enter the specific purpose.");
      return;
    }

    
    if (!form.name || !form.location || !form.duration) {
      alert("Please complete all required fields.");
      return;
    }

    const parsedDuration = parseDurationInput(form.duration);

    if (!parsedDuration) {
      alert("Please enter a valid duration such as 10 seconds, 30 minutes, or 1 hour 30 minutes.");
      return;
    }

    const { durationValue, durationUnit } = parsedDuration;

    
    setLoading(true);

    try {
    
      const selectedUid = form.uid.trim();

      
      if (!selectedUid) {
        alert("Please select an RFID tag to use.");
        setLoading(false);
        return;
      }

     
      const selectedTag = tags.find(function (tag) {
        return getTagIdentifier(tag) === selectedUid;
      });

      
      if (!selectedTag) {
        alert("Selected RFID tag was not found. Please choose a valid tag.");
        setLoading(false);
        return;
      }

      
      const tagStatus = getTagStatus(selectedTag).toLowerCase();
      const isTagAvailable = tagStatus === "available";

      
      if (!isTagAvailable) {
        alert("Selected RFID tag is currently in use. Please choose another one.");
        setLoading(false);
        return;
      }

      
      const sameUidQuery = query(
        collection(db, "visitors"),
        where("uid", "==", selectedUid),
        where("status", "==", "active")
      );
      const sameUidSnapshot = await getDocs(sameUidQuery);

     
      if (!sameUidSnapshot.empty) {
        alert("This RFID tag is already assigned to an active visitor.");
        setLoading(false);
        return;
      }

      
      const startTime = Date.now();
      const durationMultipliers = {
        seconds: 1000,
        minutes: 60000,
        hours: 3600000
      };
      const endTime = startTime + durationValue * durationMultipliers[durationUnit];

      
      const visitorDocId = `${selectedUid}_${startTime}`;
      const visitorRef = doc(db, "visitors", visitorDocId);
      
      
      const confirmStatusValue = form.purpose === "Personal / Non-School Related" ? "Not Required" : "Pending";
      const destinationConfirmations = form.destinations.map(function (destination) {
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
        specificPurpose: form.purpose === "School Related" ? form.schoolPurpose.trim() : form.nonSchoolPurpose.trim(),
        schoolPurpose: form.purpose === "School Related" ? form.schoolPurpose.trim() : "",
        nonSchoolPurpose: form.purpose === "Personal / Non-School Related" ? form.nonSchoolPurpose.trim() : "",
        destination: form.destinations.join(", "),
        destinations: form.destinations,
        location: form.location || "Entrance",
        currentLocation: "Entrance",
        duration: durationValue,
        durationText: form.duration.trim(),
        durationUnit,
        uid: selectedUid || "",
        startTime,
        endTime,
        timeIn: startTime,
        timeOut: null,
        status: "active",
        completionStatus: "Active",
        confirmStatus: confirmStatusValue,
        ...(form.purpose === "School Related" ? { destinationConfirmations } : {}),
        violationType: "",
        confirmedAt: null,
        confirmedBy: null,
        officeEntryAlerted: false
      });

      try {
        
        await updateDoc(doc(db, "rfid_tags", selectedUid), {
          Status: "In Use",
          UsedBy: form.name || "",
          currentVisitorId: visitorRef.id,
          assignedAt: startTime
        });
      } catch (error) {
        console.warn("Failed to update RFID tag status:", error);
      }

     
      alert("Visitor Registered Successfully!");
      resetForm();
    } catch (error) {
      alert(error.message);
    }

    
    setLoading(false);
  }

  
  return (
    <div>
      <h1>Register Visitor</h1>
      <form className="form-card" onSubmit={handleSubmit}>
        <input
          className="form-control"
          name="name"
          placeholder="Visitor Name"
          value={form.name}
          onChange={handleChange}
        />
        <br /><br />
        <div className="form-control purpose-section">
          <label className="purpose-row">
            <input
              className="purpose-type"
              type="radio"
              name="purpose"
              value="Personal / Non-School Related"
              checked={form.purpose === "Personal / Non-School Related"}
              onChange={handleChange}
            />
            <span className="purpose-label">Non-School Related:</span>
            <input
              className="form-control purpose-input"
              name="nonSchoolPurpose"
              placeholder="Specific purpose"
              value={form.nonSchoolPurpose}
              onChange={function (event) {
                handleChange(event);
                setForm(function (current) {
                  return { ...current, purpose: "Personal / Non-School Related" };
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
              checked={form.purpose === "School Related"}
              onChange={handleChange}
            />
            <span className="purpose-label">School Related:</span>
            <input
              className="form-control purpose-input"
              name="schoolPurpose"
              placeholder="Specific purpose"
              value={form.schoolPurpose}
              onChange={function (event) {
                handleChange(event);
                setForm(function (current) {
                  return { ...current, purpose: "School Related" };
                });
              }}
            />
          </label>
        </div>
        <br /><br />
        <div
          onMouseDown={function () {
            if (!form.purpose) {
              alert("Please select a visit type before you can select a destination.");
            }
          }}
        >
          <div className="form-control destination-section">
            <div className="destination-heading">Destination</div>
            {form.purpose && (
              <div className="destination-grid">
                {(form.purpose === "Personal / Non-School Related" ? personalDestinations : [
                  "Admin",
                  "Registrar",
                  "Guidance",
                  "CABA Dean",
                  "IT Dean",
                  "Criminology Dean",
                  "Education Dean",
                  "Librarian"
                ]).map(function (destination) {
                  const isSelected = form.destinations.includes(destination);
                  return (
                    <label key={destination} className={`destination-option ${isSelected ? "destination-option--selected" : ""}`}>
                      <input
                        className="destination-checkbox"
                        type="checkbox"
                        checked={isSelected}
                        onChange={function () {
                          setForm(function (current) {
                            const destinations = isSelected
                              ? current.destinations.filter(function (item) { return item !== destination; })
                              : [...current.destinations, destination];
                            return { ...current, destinations };
                          });
                        }}
                      />
                      <span className="destination-name">{destination}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <br /><br />
        <input
          className="form-control"
          name="location"
          placeholder="Location (Entrance)"
          value={form.location}
          onChange={handleChange}
        />
        <br /><br />
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
        <br /><br />
        {tagsLoading ? (
          <p className="empty-state">Loading RFID tags...</p>
        ) : (
          <>
            <select
              className="form-control"
              name="uid"
              value={form.uid}
              onChange={handleChange}
            >
              <option value="" style={{ color: "#A1A1AA" }}>
                -- Select RFID Tag / EPC --
              </option>
              {tags.map(function (tag) {
                const tagIdentifier = getTagIdentifier(tag);
                return (
                  <option
                    key={tagIdentifier}
                    value={tagIdentifier}
                    disabled={!isTagAvailable(tag)}
                  >
                    {formatTagLabel(tag)}
                  </option>
                );
              })}
            </select>
            <p style={{ marginTop: "0.5rem", color: "#71717A", fontSize: "0.95rem" }}>
              Available tags are selectable. In-use tags are shown but disabled.
            </p>
            {form.uid && (
              <p style={{ marginTop: "0.5rem", color: "#A1A1AA", fontSize: "0.95rem" }}>
                Selected tag: {form.uid}
              </p>
            )}
          </>
        )}
        <br /><br />
        <button className="primary-button" type="submit" disabled={loading || tagsLoading}>
          {loading ? "Saving..." : "Register Visitor"}
        </button>
      </form>
    </div>
  );
}

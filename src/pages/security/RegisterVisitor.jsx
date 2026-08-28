/**
 * pages/security/RegisterVisitor.jsx
 *
 * Layunin: Form para mag-register ng bagong visitor at mag-assign ng RFID tag.
 * - Gumagawa ng `visitors/{uid}` document at ina-update ang `rfid_tags/{uid}` status.
 * - May validation para maiwasan ang pag-assign ng in-use na RFID tag o duplicate active assignment.
 * - Bahagi ng app: security staff registration workflow.
 */
// I-import ang hooks para sa state at effect.
import { useState, useEffect } from "react";
// I-import ang Firestore helpers para sa create, read, query, at update operations.
import { doc, collection, getDocs, onSnapshot, query, setDoc, where, updateDoc } from "firebase/firestore";
// I-import ang Firestore instance para makapag-access sa database.
import { db } from "../../firebase";

// I-set ang default values ng form kapag magbubukas ang registration page.
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
  "Waiting/Bench Area"
];

const excludedRegistrationTags = new Set([
  "E28069150000502D9DF2EE8A",
  "E28069150000402D9DF3FA89",
  "E28069150000402D9DF3D97D"
]);

// I-export ang component para sa register visitor page.
export default function RegisterVisitor() {
  // I-store ang form values at listahan ng RFID tags.
  const [form, setForm] = useState(initialFormState);
  const [tags, setTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  // I-update ang form kapag may input ang user.
  function handleChange(event) {
    // Kinukuha ang field name at value mula sa input.
    const { name, value } = event.target;
    // I-copy ang current form at ina-update ang selected field.
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

    // Ini-update ang state ng form.
    setForm(nextForm);
  }

  // I-reset ang form pabalik sa default values.
  function resetForm() {
    setForm(initialFormState);
  }

  // I-extract ang tag identifier sa paraang gumagana sa iba't ibang field name.
  function getTagIdentifier(tag) {
    return tag.epc || tag.uid || tag.id || "Unknown";
  }

  // I-extract ang status ng RFID tag sa kahit anong naming convention.
  function getTagStatus(tag) {
    return (tag.Status || tag.status || "").toString() || "Unknown";
  }

  // I-extract ang nagmamay-ari ng tag kapag in-use.
  

  // I-extract ang time ng assignment ng tag.
  

  // Tinitingnan kung available ang tag para pwede itong piliin.
  function isTagAvailable(tag) {
    return getTagStatus(tag).toLowerCase() === "available";
  }

  // I-build ang label na ipinapakita sa dropdown para sa bawat tag.
  function formatTagLabel(tag) {
    return getTagIdentifier(tag);
  }

  // I-listen sa RFID tags sa Firestore para sa live dropdown data.
  useEffect(function () {
    // Pinapakinggan ang RFID tags sa Firestore.
    const unsubscribe = onSnapshot(
      collection(db, "rfid_tags"),
      function (snapshot) {
        // Ginagawa ang tag list mula sa snapshot.
        const tagList = snapshot.docs.map(function (item) {
          return { id: item.id, epc: item.id, ...item.data() };
        }).filter(function (tag) {
          return !excludedRegistrationTags.has(getTagIdentifier(tag));
        });
        // Ini-update ang state para sa tag dropdown.
        setTags(tagList);
        setTagsLoading(false);
      },
      function (error) {
        console.error("Failed to load RFID tags:", error);
        setTagsLoading(false);
      }
    );

    // I-clean up ang listener kapag hindi na ginagamit ang component.
    return function () {
      unsubscribe();
    };
  }, []);

  // I-handle ang pag-submit ng form para mag-register ng visitor.
  async function handleSubmit(event) {
    event.preventDefault();

    // Step 1: Siguraduhin na may napiling visit type.
    if (!form.purpose) {
      alert("Please complete all required fields.");
      return;
    }

    // Step 2: Siguraduhin na may napiling destination.
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

    // Step 3: Siguraduhin na may laman ang ibang required fields.
    if (!form.name || !form.location || !form.duration) {
      alert("Please complete all required fields.");
      return;
    }

    // I-convert ang duration sa number para i-validate.
    const durationValue = Number(form.duration);

    // Tinitingnan kung valid ang duration value.
    if (!durationValue || durationValue <= 0) {
      alert("Please enter a valid duration greater than 0.");
      return;
    }

    // I-set ang loading state habang sine-save ang data.
    setLoading(true);

    try {
      // Kinukuha ang selected RFID tag ID mula sa form.
      const selectedUid = form.uid.trim();

      // Kung walang napiling tag, ipinapakita ang alert.
      if (!selectedUid) {
        alert("Please select an RFID tag to use.");
        setLoading(false);
        return;
      }

      // Hanapin ang napiling tag sa listahan ng tags.
      const selectedTag = tags.find(function (tag) {
        return getTagIdentifier(tag) === selectedUid;
      });

      // Kung walang match, ipinapakita ang alert.
      if (!selectedTag) {
        alert("Selected RFID tag was not found. Please choose a valid tag.");
        setLoading(false);
        return;
      }

      // Tinitingnan ang status ng tag para siguruhin na available ito.
      const tagStatus = getTagStatus(selectedTag).toLowerCase();
      const isTagAvailable = tagStatus === "available";

      // Kung hindi available ang tag, ipinapakita ang alert.
      if (!isTagAvailable) {
        alert("Selected RFID tag is currently in use. Please choose another one.");
        setLoading(false);
        return;
      }

      // I-check kung may active visitor na gumagamit ng parehong RFID tag.
      const sameUidQuery = query(
        collection(db, "visitors"),
        where("uid", "==", selectedUid),
        where("status", "==", "active")
      );
      const sameUidSnapshot = await getDocs(sameUidQuery);

      // Kung may active visitor na may parehong tag, ipinapakita ang alert.
      if (!sameUidSnapshot.empty) {
        alert("This RFID tag is already assigned to an active visitor.");
        setLoading(false);
        return;
      }

      // Kinukuha ang current start time at i-compute ang end time base sa duration.
      const startTime = Date.now();
      const durationMultipliers = {
        seconds: 1000,
        minutes: 60000,
        hours: 3600000
      };
      const endTime = startTime + durationValue * durationMultipliers[form.durationUnit];

      // I-save ang visitor data sa Firestore gamit ang document ID na may literal na RFID tag
      // bilang prefix, kaya makikita agad ang EP/CUID sa Firestore kahit magamit muli ang tag.
      const visitorDocId = `${selectedUid}_${startTime}`;
      const visitorRef = doc(db, "visitors", visitorDocId);
      
      // Para sa Personal visitors, ang confirmStatus ay "Not Required" dahil walang confirmation kailangan.
      // Para sa School Related visitors, ang confirmStatus ay initially pending confirmation.
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
        duration: durationValue,
        durationUnit: form.durationUnit,
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
        confirmedBy: null
      });

      try {
        // Ina-update ang RFID tag status para ipakita na in use na.
        await updateDoc(doc(db, "rfid_tags", selectedUid), {
          Status: "In Use",
          UsedBy: form.name || "",
          currentVisitorId: visitorRef.id,
          assignedAt: startTime
        });
      } catch (error) {
        console.warn("Failed to update RFID tag status:", error);
      }

      // Ipapakita ang success message kapag natapos ang proseso.
      alert("Visitor Registered Successfully!");
      resetForm();
    } catch (error) {
      alert(error.message);
    }

    // I-reset ang loading state sa dulo ng process.
    setLoading(false);
  }

  // I-render ang form para sa pag-register ng visitor.
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
            type="number"
            min="0"
            placeholder="Duration"
            value={form.duration}
            onChange={handleChange}
          />
          <select
            className="form-control"
            name="durationUnit"
            value={form.durationUnit}
            onChange={handleChange}
          >
            <option value="seconds">Seconds</option>
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
          </select>
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

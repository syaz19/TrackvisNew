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
  destination: "",
  location: "Entrance",
  duration: "",
  durationUnit: "minutes",
  uid: ""
};

const personalDestinations = [
  "San Carlos College Gymnasium",
  "Elementary Building",
  "High School Building",
  "High School Faculty",
  "IT Building",
  "Education Building",
  "Criminology Building",
  "CABA Building",
  "Waiting/Bench Area"
];

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
    const nextForm = {
      ...form,
      [name]: value
    };

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

    // Step 2: Kailangan ang destination para sa parehong visitor types.
    if ((form.purpose === "Personal / Non-School Related" || form.purpose === "School Related") && !form.destination) {
      alert("Please complete all required fields.");
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
      
      await setDoc(visitorRef, {
        name: form.name,
        purpose: form.purpose,
        destination: form.destination,
        location: form.location || "Entrance",
        duration: durationValue,
        durationUnit: form.durationUnit,
        uid: selectedUid || "",
        startTime,
        endTime,
        timeIn: startTime,
        timeOut: null,
        status: "active",
        confirmStatus: confirmStatusValue,
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
        <select
          className="form-control"
          name="purpose"
          value={form.purpose}
          onChange={handleChange}
        >
          <option value="" style={{ color: "#94a3b8" }}>
            -- Purpose Visit Type --
          </option>
          <option value="Personal / Non-School Related">Personal / Non-School Related</option>
          <option value="School Related">School Related</option>
        </select>
        <br /><br />
        <div
          onMouseDown={function () {
            if (!form.purpose) {
              alert("Please select a visit type before you can select a destination.");
            }
          }}
        >
          <select
            className="form-control"
            name="destination"
            value={form.destination}
            onChange={handleChange}
            disabled={!form.purpose}
          >
            <option value="" style={{ color: "#94a3b8" }}>
              -- Select Destination --
            </option>
            {form.purpose === "Personal / Non-School Related" && personalDestinations.map(function (destination) {
              return <option key={destination} value={destination}>{destination}</option>;
            })}
            {form.purpose === "School Related" && (
              <>
                <option value="Admin">Admin</option>
                <option value="Registrar">Registrar</option>
                <option value="Guidance Counselor">Guidance Counselor</option>
                <option value="CABA Dean">CABA Dean</option>
                <option value="IT Dean">IT Dean</option>
                <option value="Criminology Dean">Criminology Dean</option>
                <option value="Education Dean">Education Dean</option>
                <option value="Librarian">Librarian</option>
              </>
            )}
          </select>
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
              <option value="" style={{ color: "#94a3b8" }}>
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
            <p style={{ marginTop: "0.5rem", color: "#64748b", fontSize: "0.95rem" }}>
              Available tags are selectable. In-use tags are shown but disabled.
            </p>
            {form.uid && (
              <p style={{ marginTop: "0.5rem", color: "#94a3b8", fontSize: "0.95rem" }}>
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

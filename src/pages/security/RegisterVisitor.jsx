import { useState, useEffect } from "react";
import { setDoc, doc, collection, getDocs, onSnapshot, query, where, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

const initialFormState = {
  name: "",
  purpose: "",
  destination: "",
  location: "Entrance",
  duration: "",
  durationUnit: "minutes",
  uid: ""
};

export default function RegisterVisitor() {
  // I-store ang form values at listahan ng RFID tags.
  const [form, setForm] = useState(initialFormState);
  const [tags, setTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    // I-update ang form base sa input na pinindot.
    const { name, value } = event.target;
    const nextForm = {
      ...form,
      [name]: value
    };

    setForm(nextForm);
  }

  function resetForm() {
    setForm(initialFormState);
  }

  function getTagIdentifier(tag) {
    return tag.epc || tag.uid || tag.id || "Unknown";
  }

  function getTagStatus(tag) {
    return (tag.Status || tag.status || "").toString() || "Unknown";
  }

  function getTagUsedBy(tag) {
    return tag.UsedBy || tag.usedBy || "";
  }

  function getTagAssignedAt(tag) {
    return tag.assignedAt || tag.timeIn || tag.timeInStamp || "";
  }

  function isTagAvailable(tag) {
    return getTagStatus(tag).toLowerCase() === "available";
  }

  function formatTagLabel(tag) {
    // Build a safe label using UID/EPC plus minimal deactivated tag fields.
    const tagId = getTagIdentifier(tag);
    const status = getTagStatus(tag);
    const usedBy = getTagUsedBy(tag);
    const assignedAt = getTagAssignedAt(tag);

    let label = `${tagId} — ${status}`;

    if (!isTagAvailable(tag)) {
      if (usedBy) {
        label += ` • ${usedBy}`;
      }

      if (assignedAt) {
        label += ` • ${new Date(assignedAt).toLocaleString()}`;
      }
    }

    return label;
  }

  useEffect(function () {
    // Pakinggan ang RFID tags sa Firestore.
    const unsubscribe = onSnapshot(
      collection(db, "rfid_tags"),
      function (snapshot) {
        const tagList = snapshot.docs.map(function (item) {
          return { id: item.id, epc: item.id, ...item.data() };
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

    // Step 1: siguraduhin na may laman ang lahat ng kailangan.
    // Step 2: suriin ang duration at RFID tag.
    // Step 3: i-save ang visitor at i-update ang tag status.
    const isFormComplete = form.name && form.purpose && form.destination && form.location && form.duration;

    if (!isFormComplete) {
      alert("Please complete all required fields.");
      return;
    }

    const durationValue = Number(form.duration);

    if (!durationValue || durationValue <= 0) {
      alert("Please enter a valid duration greater than 0.");
      return;
    }

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
      const endTime = startTime + durationValue * durationMultipliers[form.durationUnit];

      await setDoc(doc(db, "visitors", selectedUid), {
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
        confirmStatus: "No Confirmation",
        confirmedAt: null,
        confirmedBy: null
      });

      try {
        await updateDoc(doc(db, "rfid_tags", selectedUid), {
          Status: "In Use",
          UsedBy: form.name || "",
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
        <input
          className="form-control"
          name="purpose"
          placeholder="Purpose of Visit"
          value={form.purpose}
          onChange={handleChange}
        />
        <br /><br />
        <select
          className="form-control"
          name="destination"
          value={form.destination}
          onChange={handleChange}
        >
          <option value="" style={{ color: "#94a3b8" }}>
            -- Select Destination --
          </option>
          <option value="Admin">Admin</option>
          <option value="Registrar">Registrar</option>
          <option value="Guidance Counselor">Guidance Counselor</option>
          <option value="CABA Dean">CABA Dean</option>
          <option value="IT Dean">IT Dean</option>
          <option value="Criminology Dean">Criminology Dean</option>
          <option value="Education Dean">Education Dean</option>
        </select>
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
                const status = (tag.Status || tag.status || "").toString();
                const tagIdentifier = getTagIdentifier(tag);
                return (
                  <option
                    key={tagIdentifier}
                    value={tagIdentifier}
                    disabled={status.toLowerCase() !== "available"}
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

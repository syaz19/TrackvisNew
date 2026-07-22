import { useState, useEffect } from "react";
import { addDoc, doc, collection, getDocs, onSnapshot, query, where, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function RegisterVisitor() {
  // Ini-store ang form values at listahan ng RFID tags.
  const [form, setForm] = useState({
    name: "",
    purpose: "",
    destination: "",
    location: "Entrance",
    duration: "",
    durationUnit: "minutes",
    uid: ""
  });
  const [tags, setTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    // Ina-update ang form state base sa input name at value.
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  function formatTagLabel(tag) {
    // Ginagawa ang label ng tag para madaling makita ang status at owner.
    const status = (tag.Status || tag.status || "").toString() || "Unknown";
    const usedBy = tag.UsedBy || tag.usedBy || "";
    const assignedAt = tag.assignedAt || tag.timeIn || tag.timeInStamp || "";

    let label = `${tag.id} — ${status}`;

    if (usedBy) {
      label += ` • ${usedBy}`;
    }

    if (assignedAt) {
      label += ` • ${new Date(assignedAt).toLocaleString()}`;
    }

    return label;
  }

  useEffect(() => {
    // Tinutunghayan ang RFID tags sa Firestore.
    const unsubscribe = onSnapshot(
      collection(db, "rfid_tags"),
      (snapshot) => {
        const list = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        setTags(list);
        setTagsLoading(false);
      },
      (error) => {
        console.error("Failed to load RFID tags:", error);
        setTagsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  async function handleSubmit() {
    // Pinipigilan ang pag-save kung kulang ang entries.
    if (!form.name || !form.purpose || !form.destination || !form.location || !form.duration) {
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
      const uid = form.uid.trim();

      if (!uid) {
        alert("Please select an RFID tag to use.");
        setLoading(false);
        return;
      }

      const selectedTag = tags.find((tag) => tag.id === uid);

      if (!selectedTag) {
        alert("Selected RFID tag was not found. Please choose a valid tag.");
        setLoading(false);
        return;
      }

      const tagStatus = (selectedTag.Status || selectedTag.status || "").toString().toLowerCase();

      if (tagStatus && tagStatus !== "available") {
        alert("Selected RFID tag is currently in use. Please choose another one.");
        setLoading(false);
        return;
      }

      const sameUidQuery = query(
        collection(db, "visitors"),
        where("uid", "==", uid),
        where("status", "==", "active")
      );
      const sameUidSnapshot = await getDocs(sameUidQuery);

      if (!sameUidSnapshot.empty) {
        alert("This RFID tag is already assigned to an active visitor.");
        setLoading(false);
        return;
      }

      const startTime = Date.now();
      const unitMultipliers = {
        seconds: 1000,
        minutes: 60000,
        hours: 3600000
      };
      const endTime = startTime + durationValue * unitMultipliers[form.durationUnit];

      await addDoc(collection(db, "visitors"), {
        name: form.name,
        purpose: form.purpose,
        destination: form.destination,
        duration: durationValue,
        durationUnit: form.durationUnit,
        uid: uid || "",
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
        await updateDoc(doc(db, "rfid_tags", uid), {
          Status: "In Use",
          UsedBy: form.name || "",
          assignedAt: startTime
        });
      } catch (error) {
        console.warn("Failed to update RFID tag status:", error);
      }

      alert("Visitor Registered Successfully!");
      setForm({
        name: "",
        purpose: "",
        destination: "",
        location: "Entrance",
        duration: "",
        durationUnit: "minutes",
        uid: ""
      });
    } catch (error) {
      alert(error.message);
    }

    setLoading(false);
  }

  return (
    <div>
      <h1>Register Visitor</h1>
      <div className="form-card">
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
              {tags.map((tag) => {
                const status = (tag.Status || tag.status || "").toString();
                return (
                  <option key={tag.id} value={tag.id} disabled={status.toLowerCase() !== "available"}>
                    {formatTagLabel(tag)}
                  </option>
                );
              })}
            </select>
            <p style={{ marginTop: "0.5rem", color: "#64748b", fontSize: "0.95rem" }}>
              Available tags are selectable. In-use tags are shown but disabled.
            </p>
            {form.uid && (
              <p style={{ marginTop: "0.5rem", color: "#94a3b8", fontSize: "0.95rem" }}>Selected tag: {form.uid}</p>
            )}
          </>
        )}
        <br /><br />
        <button className="primary-button" onClick={handleSubmit} disabled={loading || tagsLoading}>
          {loading ? "Saving..." : "Register Visitor"}
        </button>
      </div>
    </div>
  );
}

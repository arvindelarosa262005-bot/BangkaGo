import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { backend, configured } from "./client";
export function ConfigurationEditor() {
  const [kind, setKind] = useState("location");
  const [name, setName] = useState("");
  const [municipality, setMunicipality] = useState("Abra de Ilog");
  const [province, setProvince] = useState("Occidental Mindoro");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [setting, setSetting] = useState("cancellation_policy");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const qc = useQueryClient();
  const locations = useQuery({
    queryKey: ["locations"],
    enabled: configured,
    queryFn: () => backend.rows("locations"),
  });
  const requirements = useQuery({
    queryKey: ["requirements"],
    enabled: configured,
    queryFn: () => backend.rows("document_requirements"),
  });
  const settings = useQuery({
    queryKey: ["settings"],
    enabled: configured,
    queryFn: () => backend.rows("app_settings"),
  });
  const mutation = useMutation({
    mutationFn: () =>
      backend.rpc("configure_platform", {
        p_kind: kind,
        p_data: {
          name,
          municipality,
          province,
          origin_id: origin,
          destination_id: destination,
          key: setting,
          value,
          reason,
        },
      }),
    onSuccess: () => {
      setMessage("Configuration saved and audited.");
      qc.invalidateQueries();
    },
    onError: (e) => setMessage(e.message),
  });
  return (
    <section className="panel padded">
      <h2>Locations, policies & document requirements</h2>
      <p>
        Keep operating locations and registration requirements aligned with
        approved operations.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label>
          Configuration type
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="location">Add location</option>
            <option value="route">Add route</option>
            <option value="requirement">Add document requirement</option>
            <option value="setting">Update public policy / branding</option>
          </select>
        </label>
        {["location", "requirement"].includes(kind) && (
          <label>
            Name
            <input
              required
              maxLength={150}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        {kind === "location" && (
          <>
            <label>
              Municipality
              <input
                required
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
              />
            </label>
            <label>
              Province
              <input
                required
                value={province}
                onChange={(e) => setProvince(e.target.value)}
              />
            </label>
          </>
        )}
        {kind === "route" && (
          <>
            <label>
              Departure
              <select
                required
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              >
                <option value="">Choose location</option>
                {locations.data?.map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Destination
              <select
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="">Choose location</option>
                {locations.data?.map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {kind === "setting" && (
          <>
            <label>
              Policy / branding field
              <select
                value={setting}
                onChange={(e) => setSetting(e.target.value)}
              >
                <option value="cancellation_policy">Cancellation policy</option>
                <option value="platform_name">Platform name</option>
                <option value="document_notice">Document notice</option>
                <option value="privacy_contact">Privacy contact</option>
              </select>
            </label>
            <label>
              Text value
              <textarea
                required
                maxLength={4000}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
          </>
        )}
        {kind === "requirement" && (
          <p>
            This adds a requirement for all boat types and locations. Review the
            impact on existing operators before saving.
          </p>
        )}
        <label>
          Reason for change
          <textarea
            required
            minLength={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button disabled={!configured || mutation.isPending}>
          Save configuration
        </button>
        <p role="status">{message}</p>
      </form>
      <h3>Current document requirements</h3>
      {requirements.error ? (
        <p className="error">{requirements.error.message}</p>
      ) : (
        requirements.data?.map((r) => (
          <p key={r.id}>
            {r.name}
            {r.required ? " · Required" : " · Optional"}
          </p>
        ))
      )}
      <h3>Published settings</h3>
      {settings.data?.map((s) => (
        <p key={s.key}>
          <strong>{s.key.replaceAll("_", " ")}</strong>
          <br />
          {String(s.value)}
        </p>
      ))}
    </section>
  );
}

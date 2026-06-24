import { useEffect, useMemo, useRef, useState } from "react";
import { api, clearToken, getToken, setToken } from "./api";

const viewLabels = {
  dashboard: "Dashboard",
  alerts: "Alerts",
  compare: "Compare",
  settings: "Settings",
};

function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [currentView, setCurrentView] = useState("dashboard");
  const [summary, setSummary] = useState(null);
  const [selectedMachineId, setSelectedMachineId] = useState(1);
  const [lastUpdated, setLastUpdated] = useState("Waiting for live data");
  const [alertFilter, setAlertFilter] = useState("");
  const [thresholds, setThresholds] = useState(null);
  const [settingsMessage, setSettingsMessage] = useState("");

  const machines = summary?.machines || [];
  const alerts = summary?.alerts || [];

  async function completeAuth(result) {
    setToken(result.token);
    setUser(result.user);
    setAuthError("");
    await loadAll();
  }

  async function loadAll() {
    try {
      const data = await api("/api/summary");
      setSummary(data);
      if (
        !data.machines.some(
          (machine) => Number(machine.id) === Number(selectedMachineId),
        )
      ) {
        setSelectedMachineId(data.machines[0]?.id || 1);
      }
      setLastUpdated(`Updated ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      setLastUpdated(error.message);
    }
  }

  useEffect(() => {
    async function boot() {
      if (!getToken()) return;
      try {
        const result = await api("/api/me");
        setUser(result.user);
        await loadAll();
      } catch {
        clearToken();
      }
    }
    boot();
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const timer = setInterval(loadAll, 2000);
    return () => clearInterval(timer);
  }, [user, selectedMachineId]);

  useEffect(() => {
    if (currentView !== "settings" || !user) return;
    api("/api/thresholds")
      .then(setThresholds)
      .catch((error) => setSettingsMessage(error.message));
  }, [currentView, user]);

  async function handleLogin(event) {
    event.preventDefault();
    setAuthError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api("/api/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      await completeAuth(result);
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setAuthError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api("/api/register", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      await completeAuth(result);
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function handleLogout() {
    await api("/api/logout", { method: "POST" }).catch(() => {});
    clearToken();
    setUser(null);
    setSummary(null);
    setAuthMode("login");
  }

  async function simulateReading() {
    await api("/api/simulate", { method: "POST" });
    await loadAll();
  }

  async function acknowledgeAlert(alertId) {
    await api("/api/alerts/ack", {
      method: "POST",
      body: JSON.stringify({ alert_id: alertId }),
    });
    await loadAll();
  }

  async function saveThresholds(event) {
    event.preventDefault();
    setSettingsMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api("/api/thresholds", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      setThresholds(result);
      setSettingsMessage("Thresholds updated.");
      await loadAll();
    } catch (error) {
      setSettingsMessage(error.message);
    }
  }

  if (!user) {
    return (
      <AuthScreen
        mode={authMode}
        error={authError}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError("");
        }}
      />
    );
  }

  return (
    <main className="app">
      <Sidebar
        user={user}
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={handleLogout}
      />
      <section className="content">
        <header className="topbar">
          <div>
            <h1>{viewLabels[currentView]}</h1>
            <p>{lastUpdated}</p>
          </div>
          <div className="actions">
            <select
              value={selectedMachineId}
              onChange={(event) =>
                setSelectedMachineId(Number(event.target.value))
              }
            >
              {machines.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}
                </option>
              ))}
            </select>
            <button onClick={simulateReading}>Simulate Reading</button>
            {/* <a className="button secondary" href={`/api/export.csv?machine_id=${selectedMachineId}`}>Export CSV</a> */}
          </div>
        </header>

        {currentView === "dashboard" && (
          <Dashboard summary={summary} selectedMachineId={selectedMachineId} />
        )}
        {currentView === "alerts" && (
          <Alerts
            alerts={alerts}
            filter={alertFilter}
            onFilterChange={setAlertFilter}
            onAck={acknowledgeAlert}
          />
        )}
        {currentView === "compare" && <Compare machines={machines} />}
        {currentView === "settings" && (
          <Settings
            user={user}
            thresholds={thresholds}
            message={settingsMessage}
            onSave={saveThresholds}
          />
        )}
      </section>
    </main>
  );
}

function AuthScreen({ mode, error, onLogin, onRegister, onModeChange }) {
  return (
    <main className="login-view">
      {mode === "login" ? (
        <form className="login-panel" onSubmit={onLogin}>
          <p className="eyebrow">Industrial Monitoring</p>
          <h1>Predictive Maintenance</h1>
          <label>
            Username
            <input
              name="username"
              autoComplete="username"
              defaultValue="admin"
              required
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              defaultValue="admin123"
              required
            />
          </label>
          <button type="submit">Sign in</button>
          <button
            className="secondary link-button"
            type="button"
            onClick={() => onModeChange("register")}
          >
            Create new account
          </button>
          <p className="error">{error}</p>
        </form>
      ) : (
        <form className="login-panel" onSubmit={onRegister}>
          <p className="eyebrow">New User</p>
          <h1>Register</h1>
          <label>
            Username
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            Role
            <select name="role" defaultValue="Viewer">
              <option value="Viewer">Viewer</option>
              <option value="Operator">Operator</option>
              <option value="Admin">Admin</option>
            </select>
          </label>
          <button type="submit">Register</button>
          <button
            className="secondary link-button"
            type="button"
            onClick={() => onModeChange("login")}
          >
            Back to login
          </button>
          <p className="error">{error}</p>
        </form>
      )}
    </main>
  );
}

function Sidebar({ user, currentView, onViewChange, onLogout }) {
  return (
    <aside className="sidebar">
      <div>
        <p className="eyebrow">AI + IoT</p>
        <h2>Machine Health</h2>
      </div>
      <nav>
        {Object.entries(viewLabels).map(([key, label]) => (
          <button
            key={key}
            className={`nav-button ${currentView === key ? "active" : ""}`}
            onClick={() => onViewChange(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="user-box">
        <span>
          {user.username} - {user.role}
        </span>
        <button className="secondary" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}

function Dashboard({ summary, selectedMachineId }) {
  const counts = summary?.counts || {
    total: 0,
    normal: 0,
    warning: 0,
    critical: 0,
  };
  const machines = summary?.machines || [];

  return (
    <>
      <div className="metric-grid">
        <Metric label="Total Machines" value={counts.total} />
        <Metric label="Normal" value={counts.normal} />
        <Metric label="Warning" value={counts.warning} />
        <Metric label="Critical" value={counts.critical} />
      </div>
      <div className="machine-grid">
        {machines.map((machine) => (
          <MachineCard key={machine.id} machine={machine} />
        ))}
      </div>
      <section className="panel">
        <div className="panel-header">
          <h2>Last 24 Hours Vibration Trend</h2>
          <span>Machine #{selectedMachineId}</span>
        </div>
        <TrendChart machineId={selectedMachineId} />
      </section>
    </>
  );
}

function Metric({ label, value }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function MachineCard({ machine }) {
  const status = machine.status || "Normal";
  return (
    <article className="machine-card">
      <h3>{machine.name}</h3>
      <p>
        {machine.location} - {machine.sensor_node}
      </p>
      <span className={`status ${status}`}>{machine.status || "No Data"}</span>
      <div className="reading-grid">
        <Reading
          label="Health"
          value={`${formatNumber(machine.health_score)}%`}
        />
        <Reading
          label="Vibration"
          value={`${formatNumber(machine.vibration_magnitude)} g`}
        />
        <Reading
          label="Temp"
          value={`${formatNumber(machine.temperature)} C`}
        />
        <Reading label="Current" value={`${formatNumber(machine.current)} A`} />
      </div>
    </article>
  );
}

function Reading({ label, value }) {
  return (
    <div className="reading">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TrendChart({ machineId }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Loading chart");

  useEffect(() => {
    let cancelled = false;
    async function draw() {
      const { history } = await api(
        `/api/history?machine_id=${machineId}&hours=24`,
      );
      if (cancelled) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!history.length) {
        setStatus("No data");
        return;
      }
      setStatus(`${history.length} readings`);
      drawLineChart(
        ctx,
        canvas,
        history.map((row) => Number(row.vibration_magnitude)),
      );
    }
    draw().catch((error) => setStatus(error.message));
    return () => {
      cancelled = true;
    };
  }, [machineId]);

  return (
    <>
      <p className="chart-status">{status}</p>
      <canvas ref={canvasRef} width="900" height="320" />
    </>
  );
}

function drawLineChart(ctx, canvas, values) {
  const padding = 42;
  const width = canvas.width - padding * 2;
  const height = canvas.height - padding * 2;
  const max = Math.max(...values, 2.4);
  const min = 0;

  ctx.strokeStyle = "#d9dee7";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding + (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#1f7a8c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = padding + (index / Math.max(values.length - 1, 1)) * width;
    const y = padding + height - ((value - min) / (max - min)) * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#17202a";
  ctx.font = "14px Arial";
  ctx.fillText("Vibration magnitude (g)", padding, 22);
  ctx.fillText(
    `Max ${Math.max(...values).toFixed(2)} g`,
    canvas.width - padding - 90,
    22,
  );
}

function Alerts({ alerts, filter, onFilterChange, onAck }) {
  const filteredAlerts = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return alerts.filter((alert) =>
      `${alert.machine_name} ${alert.severity} ${alert.alert_message}`
        .toLowerCase()
        .includes(term),
    );
  }, [alerts, filter]);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Alert History</h2>
        <input
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder="Filter alerts"
        />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Machine</th>
              <th>Severity</th>
              <th>Message</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlerts.map((alert) => (
              <tr key={alert.alert_id}>
                <td>{alert.timestamp}</td>
                <td>{alert.machine_name}</td>
                <td className={`severity ${alert.severity}`}>
                  {alert.severity}
                </td>
                <td>{alert.alert_message}</td>
                <td>
                  {alert.acknowledged ? (
                    "Acknowledged"
                  ) : (
                    <button
                      className="secondary"
                      onClick={() => onAck(alert.alert_id)}
                    >
                      Ack
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Compare({ machines }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Machine Comparison</h2>
        <span>Health score, vibration, temperature, and current</span>
      </div>
      <div className="compare-list">
        {machines.map((machine) => {
          const health = Number(machine.health_score || 0);
          return (
            <div className="compare-item" key={machine.id}>
              <div className="compare-row">
                <strong>{machine.name}</strong>
                <div className="bar">
                  <span style={{ width: `${health}%` }} />
                </div>
                <span>{health.toFixed(1)}%</span>
              </div>
              <div className="compare-row muted-row">
                <span>
                  Vibration {formatNumber(machine.vibration_magnitude)} g
                </span>
                <span>Temperature {formatNumber(machine.temperature)} C</span>
                <span>Current {formatNumber(machine.current)} A</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Settings({ user, thresholds, message, onSave }) {
  const labels = {
    warning_vibration: "Warning vibration",
    critical_vibration: "Critical vibration",
    warning_temperature: "Warning temperature",
    critical_temperature: "Critical temperature",
    warning_current: "Warning current",
    critical_current: "Critical current",
  };

  return (
    <section className="panel settings-panel">
      <div className="panel-header">
        <h2>Threshold Configuration</h2>
        <span>Admin users can tune warning and critical limits</span>
      </div>
      <form className="settings-grid" onSubmit={onSave}>
        {Object.entries(labels).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              name={key}
              type="number"
              step="0.1"
              defaultValue={thresholds?.[key] ?? ""}
              disabled={user.role !== "Admin"}
            />
          </label>
        ))}
        {user.role === "Admin" && (
          <button type="submit">Save thresholds</button>
        )}
      </form>
      <p className="notice">{message}</p>
    </section>
  );
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : "0.0";
}

export default App;

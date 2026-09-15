"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLogs() {
      try {
        const response = await fetch("/api/admin/logs", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) {
          setError(result.error || "Errore durante il caricamento del log.");
          return;
        }
        setLogs(result);
      } catch {
        setError("Errore durante il caricamento del log.");
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
  }, []);

  return (
    <main className="page">
      <div className="container">
        <Link href="/admin" className="back">← Torna all'amministrazione</Link>

        <header>
          <span className="eyebrow">AMMINISTRAZIONE</span>
          <h1>📋 Log attività</h1>
          <p>Registro delle azioni effettuate dagli utenti.</p>
        </header>

        {loading ? (
          <div className="empty">Caricamento log...</div>
        ) : error ? (
          <div className="error">⚠️ {error}</div>
        ) : logs.length === 0 ? (
          <div className="empty">Nessuna attività registrata.</div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Ora</th>
                  <th>Utente</th>
                  <th>Azione effettuata</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const date = new Date(log.created_at);
                  return (
                    <tr key={log.id}>
                      <td>{date.toLocaleDateString("it-IT")}</td>
                      <td>{date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                      <td>{log.user_name || "Utente"}</td>
                      <td>
                        <strong>{log.action}</strong>
                        {log.details ? <span className="details">{log.details}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .page { min-height: 100vh; background: #f4f6f1; padding: 35px 20px 60px; font-family: Arial, Helvetica, sans-serif; }
        .container { max-width: 1100px; margin: 0 auto; }
        .back { color: #55745b; text-decoration: none; font-weight: 700; }
        header { margin: 28px 0; }
        .eyebrow { color: #55745b; font-size: 12px; font-weight: 800; letter-spacing: 1.3px; }
        h1 { color: #354d3b; font-size: 38px; margin: 8px 0; }
        header p { color: #687168; }
        .tableWrap { overflow-x: auto; background: #fffdf8; border: 1px solid #e8dfcf; border-radius: 20px; box-shadow: 0 8px 24px rgba(50,70,50,.06); }
        table { width: 100%; border-collapse: collapse; min-width: 650px; }
        th, td { padding: 15px 18px; text-align: left; border-bottom: 1px solid #e8dfcf; color: #354d3b; }
        th { background: #eef3eb; color: #55745b; font-size: 13px; text-transform: uppercase; letter-spacing: .5px; }
        tr:last-child td { border-bottom: none; }
        .details { display: block; color: #687168; font-size: 13px; margin-top: 4px; }
        .empty, .error { padding: 30px; border-radius: 20px; background: #fffdf8; text-align: center; }
        .error { color: #b42318; }
        @media (max-width: 700px) { h1 { font-size: 30px; } .page { padding: 28px 14px 50px; } th, td { padding: 13px 12px; } }
      `}</style>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminUtentiPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showNewUser, setShowNewUser] = useState(false);

  const [newUser, setNewUser] = useState({
    nome: "",
    email: "",
    password: "",
    ruolo: "user",
  });

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/users", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Errore durante il caricamento degli utenti."
        );
        setLoading(false);
        return;
      }

      setUsers(result);
    } catch {
      setError(
        "Errore durante il caricamento degli utenti."
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function createUser() {
    setError("");

    if (
      !newUser.nome.trim() ||
      !newUser.email.trim() ||
      !newUser.password
    ) {
      setError(
        "Compila nome, email e password."
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        "/api/admin/users",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newUser),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Errore durante la creazione dell'utente."
        );
        setSaving(false);
        return;
      }

      setUsers((current) => [
        ...current,
        result,
      ]);

      setNewUser({
        nome: "",
        email: "",
        password: "",
        ruolo: "user",
      });

      setShowNewUser(false);
    } catch {
      setError(
        "Errore durante la creazione dell'utente."
      );
    }

    setSaving(false);
  }

  async function changeRole(id, ruolo) {
    setError("");

    const response = await fetch(
      "/api/admin/users",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          ruolo,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      setError(
        result.error ||
          "Errore durante la modifica del ruolo."
      );
      return;
    }

    setUsers((current) =>
      current.map((user) =>
        user.id === id
          ? { ...user, ruolo: result.ruolo }
          : user
      )
    );
  }

  async function deleteUser(id, nome) {
    const confirmed = window.confirm(
      `Vuoi davvero eliminare l'utente "${nome || "senza nome"}"?`
    );

    if (!confirmed) return;

    setError("");

    const response = await fetch(
      "/api/admin/users",
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      setError(
        result.error ||
          "Errore durante l'eliminazione."
      );
      return;
    }

    setUsers((current) =>
      current.filter((user) => user.id !== id)
    );
  }

  return (
    <main className="page">
      <div className="container">
        <Link href="/admin" className="back">
          ← Torna all'amministrazione
        </Link>

        <header>
          <span className="eyebrow">
            AMMINISTRAZIONE
          </span>

          <h1>👥 Gestione utenti</h1>

          <p>
            Gestisci gli utenti e i relativi livelli
            di accesso.
          </p>
        </header>

        <div className="toolbar">
          <button
            className="newUserButton"
            onClick={() =>
              setShowNewUser(
                (current) => !current
              )
            }
          >
            {showNewUser
              ? "✕ Chiudi"
              : "➕ Nuovo utente"}
          </button>
        </div>

        {showNewUser && (
          <div className="newUserPanel">
            <h2>➕ Crea nuovo utente</h2>

            <div className="formGrid">
              <label>
                Nome
                <input
                  value={newUser.nome}
                  onChange={(event) =>
                    setNewUser((current) => ({
                      ...current,
                      nome:
                        event.target.value,
                    }))
                  }
                  placeholder="Nome dell'utente"
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(event) =>
                    setNewUser((current) => ({
                      ...current,
                      email:
                        event.target.value,
                    }))
                  }
                  placeholder="email@esempio.it"
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(event) =>
                    setNewUser((current) => ({
                      ...current,
                      password:
                        event.target.value,
                    }))
                  }
                  placeholder="Almeno 6 caratteri"
                />
              </label>

              <label>
                Ruolo
                <select
                  value={newUser.ruolo}
                  onChange={(event) =>
                    setNewUser((current) => ({
                      ...current,
                      ruolo:
                        event.target.value,
                    }))
                  }
                >
                  <option value="user">
                    Utente
                  </option>

                  <option value="admin">
                    Admin
                  </option>
                </select>
              </label>
            </div>

            <button
              className="saveUser"
              onClick={createUser}
              disabled={saving}
            >
              {saving
                ? "Creazione..."
                : "💾 Crea utente"}
            </button>
          </div>
        )}

        {error && (
          <div className="error">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="empty">
            Caricamento utenti...
          </div>
        ) : users.length === 0 ? (
          <div className="empty">
            Nessun utente presente.
          </div>
        ) : (
          <div className="users">
            {users.map((user) => (
              <div
                className="userCard"
                key={user.id}
              >
                <div className="userInfo">
                  <div className="avatar">
                    👤
                  </div>

                  <div>
                    <h2>
                      {user.nome || "Utente senza nome"}
                    </h2>

                    <p className="date">
                      Registrato il{" "}
                      {user.created_at
                        ? new Date(
                            user.created_at
                          ).toLocaleDateString(
                            "it-IT"
                          )
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="actions">
                  <select
                    value={user.ruolo || "user"}
                    onChange={(event) =>
                      changeRole(
                        user.id,
                        event.target.value
                      )
                    }
                  >
                    <option value="user">
                      Utente
                    </option>

                    <option value="admin">
                      Admin
                    </option>
                  </select>

                  <button
                    className="delete"
                    onClick={() =>
                      deleteUser(
                        user.id,
                        user.nome
                      )
                    }
                  >
                    🗑️ Elimina
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .page {
          min-height: 100vh;
          background: #f4f6f1;
          padding: 35px 20px 60px;
          font-family: Arial, Helvetica, sans-serif;
        }

        .container {
          max-width: 1000px;
          margin: 0 auto;
        }

        .back {
          color: #55745b;
          text-decoration: none;
          font-weight: 700;
        }

        header {
          margin: 28px 0;
        }

        .eyebrow {
          color: #55745b;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.3px;
        }

        h1 {
          color: #354d3b;
          font-size: 38px;
          margin: 8px 0;
        }

        header p {
          color: #687168;
        }

        .toolbar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 18px;
        }

        .newUserButton {
          border: none;
          background: #55745b;
          color: white;
          border-radius: 12px;
          padding: 12px 18px;
          cursor: pointer;
          font-weight: 800;
          font-size: 14px;
        }

        .newUserButton:hover {
          background: #354d3b;
        }

        .newUserPanel {
          margin-bottom: 20px;
          padding: 24px;
          border-radius: 20px;
          background: #fffdf8;
          border: 1px solid #dfe8d8;
          box-shadow:
            0 8px 24px rgba(50, 70, 50, .06);
        }

        .newUserPanel h2 {
          margin: 0 0 20px;
        }

        .formGrid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .formGrid label {
          display: flex;
          flex-direction: column;
          gap: 7px;
          color: #354d3b;
          font-weight: 700;
          font-size: 14px;
        }

        .formGrid input,
        .formGrid select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #c7d0c4;
          border-radius: 10px;
          padding: 11px 12px;
          background: white;
          color: #354d3b;
          font-size: 14px;
        }

        .saveUser {
          margin-top: 18px;
          border: none;
          background: #55745b;
          color: white;
          border-radius: 12px;
          padding: 12px 18px;
          cursor: pointer;
          font-weight: 800;
        }

        .saveUser:disabled {
          opacity: .6;
          cursor: default;
        }

        .users {
          display: grid;
          gap: 16px;
        }

        .userCard {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 22px;
          background: #fffdf8;
          border: 1px solid #e8dfcf;
          border-radius: 20px;
          box-shadow:
            0 8px 24px rgba(50, 70, 50, .06);
        }

        .userInfo {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .avatar {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: #e8f0e5;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
        }

        h2 {
          margin: 0 0 5px;
          color: #354d3b;
          font-size: 19px;
        }

        .date {
          margin: 0;
          color: #687168;
          font-size: 13px;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        select {
          border: 1px solid #c7d0c4;
          border-radius: 10px;
          padding: 10px 12px;
          background: white;
          color: #354d3b;
          font-weight: 700;
          cursor: pointer;
        }

        button {
          border-radius: 10px;
          padding: 10px 13px;
          cursor: pointer;
          font-weight: 700;
        }

        .delete {
          border: 1px solid #e2b8b5;
          background: #fff5f4;
          color: #b42318;
        }

        .empty,
        .error {
          padding: 30px;
          border-radius: 20px;
          background: #fffdf8;
          text-align: center;
        }

        .error {
          margin-bottom: 18px;
          color: #b42318;
        }

        @media (max-width: 700px) {
          h1 {
            font-size: 30px;
          }

          .formGrid {
            grid-template-columns: 1fr;
          }

          .toolbar {
            justify-content: stretch;
          }

          .newUserButton {
            width: 100%;
          }

          .userCard {
            align-items: flex-start;
            flex-direction: column;
          }

          .actions {
            width: 100%;
          }

          select,
          button {
            flex: 1;
          }
        }
      `}</style>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function RecuperoPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");

  const [recoveryMode, setRecoveryMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const [messaggio, setMessaggio] = useState("");
  const [errore, setErrore] = useState("");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setErrore("");
        setMessaggio("");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const inviaEmail = async (event) => {
    event.preventDefault();

    setLoading(true);
    setErrore("");
    setMessaggio("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/recupero-password`,
    });

    if (error) {
      setErrore(
        "Non è stato possibile inviare l'email. Riprova tra poco."
      );
      setLoading(false);
      return;
    }

    setMessaggio(
      "Se l'indirizzo email è associato a un account, riceverai a breve un messaggio con il link per reimpostare la password."
    );

    setLoading(false);
  };

  const aggiornaPassword = async (event) => {
    event.preventDefault();

    setErrore("");
    setMessaggio("");

    if (password.length < 8) {
      setErrore("La nuova password deve contenere almeno 8 caratteri.");
      return;
    }

    if (password !== confermaPassword) {
      setErrore("Le due password non coincidono.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setErrore(
        "Non è stato possibile aggiornare la password. Il link potrebbe essere scaduto o non più valido."
      );
      setLoading(false);
      return;
    }

    setPassword("");
    setConfermaPassword("");
    setMessaggio(
      "Password aggiornata correttamente! Ora puoi accedere con la nuova password."
    );

    setLoading(false);

    await supabase.auth.signOut();
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f6f1",
        padding: "24px",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "430px",
          background: "#fffdf8",
          border: "1px solid #e8dfcf",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 10px 30px rgba(50,70,50,0.08)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "28px",
          }}
        >
          <div style={{ fontSize: "48px" }}>🔐</div>

          <h1
            style={{
              color: "#354d3b",
              margin: "10px 0 6px",
            }}
          >
            Recupero password
          </h1>

          <p
            style={{
              color: "#687168",
              margin: 0,
              lineHeight: "1.5",
            }}
          >
            {recoveryMode
              ? "Scegli una nuova password per il tuo account."
              : "Inserisci la tua email per ricevere il link di recupero."}
          </p>
        </div>

        {!recoveryMode ? (
          <form
            onSubmit={inviaEmail}
            style={{
              display: "grid",
              gap: "14px",
            }}
          >
            <label
              style={{
                color: "#354d3b",
                fontWeight: "600",
              }}
            >
              Email

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="nome@email.it"
                style={inputStyle}
              />
            </label>

            {errore && (
              <div style={errorStyle}>
                {errore}
              </div>
            )}

            {messaggio && (
              <div style={successStyle}>
                {messaggio}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={buttonStyle}
            >
              {loading ? "Invio..." : "Invia link di recupero"}
            </button>

            <Link
              href="/login"
              style={backLinkStyle}
            >
              ← Torna al login
            </Link>
          </form>
        ) : (
          <form
            onSubmit={aggiornaPassword}
            style={{
              display: "grid",
              gap: "14px",
            }}
          >
            <label
              style={{
                color: "#354d3b",
                fontWeight: "600",
              }}
            >
              Nuova password

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                style={inputStyle}
              />
            </label>

            <label
              style={{
                color: "#354d3b",
                fontWeight: "600",
              }}
            >
              Conferma nuova password

              <input
                type="password"
                value={confermaPassword}
                onChange={(e) => setConfermaPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                style={inputStyle}
              />
            </label>

            {errore && (
              <div style={errorStyle}>
                {errore}
              </div>
            )}

            {messaggio && (
              <div style={successStyle}>
                {messaggio}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={buttonStyle}
            >
              {loading ? "Aggiornamento..." : "Imposta nuova password"}
            </button>

            {messaggio && (
              <Link
                href="/login"
                style={backLinkStyle}
              >
                Torna al login
              </Link>
            )}
          </form>
        )}
      </section>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  marginTop: "7px",
  borderRadius: "12px",
  border: "1px solid #d8d0c0",
  fontSize: "15px",
  outline: "none",
};

const buttonStyle = {
  width: "100%",
  padding: "13px",
  border: "none",
  borderRadius: "12px",
  background: "#55745b",
  color: "white",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "16px",
  marginTop: "6px",
};

const errorStyle = {
  background: "#fff0ed",
  color: "#b42318",
  padding: "12px",
  borderRadius: "10px",
  fontSize: "14px",
  lineHeight: "1.4",
};

const successStyle = {
  background: "#edf7ee",
  color: "#35643b",
  padding: "12px",
  borderRadius: "10px",
  fontSize: "14px",
  lineHeight: "1.4",
};

const backLinkStyle = {
  color: "#55745b",
  textAlign: "center",
  fontSize: "14px",
  textDecoration: "none",
  fontWeight: "600",
  marginTop: "4px",
};

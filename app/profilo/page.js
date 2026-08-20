"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function ProfiloPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);

  const [passwordAttualeEmail, setPasswordAttualeEmail] = useState("");
  const [nuovaEmail, setNuovaEmail] = useState("");

  const [passwordAttualePassword, setPasswordAttualePassword] = useState("");
  const [nuovaPassword, setNuovaPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");

  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");

  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setEmail(user.email || "");
      }

      setLoadingUser(false);
    };

    loadUser();
  }, [supabase]);

  const verificaPassword = async (password) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return {
        ok: false,
        error: "Utente non autenticato.",
      };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (error) {
      return {
        ok: false,
        error: "La password attuale non è corretta.",
      };
    }

    return { ok: true };
  };

  const cambiaEmail = async (event) => {
    event.preventDefault();

    setEmailError("");
    setEmailMessage("");

    if (!nuovaEmail.trim()) {
      setEmailError("Inserisci la nuova email.");
      return;
    }

    if (nuovaEmail.trim().toLowerCase() === email.toLowerCase()) {
      setEmailError("La nuova email coincide con quella attuale.");
      return;
    }

    if (!passwordAttualeEmail) {
      setEmailError("Inserisci la password attuale.");
      return;
    }

    setLoadingEmail(true);

    const verifica = await verificaPassword(passwordAttualeEmail);

    if (!verifica.ok) {
      setEmailError(verifica.error);
      setLoadingEmail(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      email: nuovaEmail.trim(),
    });

    if (error) {
      setEmailError(
        "Non è stato possibile modificare l'email. Controlla l'indirizzo e riprova."
      );
      setLoadingEmail(false);
      return;
    }

    setEmailMessage(
      "Richiesta inviata. Controlla la nuova email e conferma il cambio di indirizzo."
    );

    setPasswordAttualeEmail("");
    setNuovaEmail("");
    setLoadingEmail(false);
  };

  const cambiaPassword = async (event) => {
    event.preventDefault();

    setPasswordError("");
    setPasswordMessage("");

    if (!passwordAttualePassword) {
      setPasswordError("Inserisci la password attuale.");
      return;
    }

    if (nuovaPassword.length < 8) {
      setPasswordError(
        "La nuova password deve contenere almeno 8 caratteri."
      );
      return;
    }

    if (nuovaPassword !== confermaPassword) {
      setPasswordError(
        "La nuova password e la conferma non coincidono."
      );
      return;
    }

    if (nuovaPassword === passwordAttualePassword) {
      setPasswordError(
        "La nuova password deve essere diversa da quella attuale."
      );
      return;
    }

    setLoadingPassword(true);

    const verifica = await verificaPassword(
      passwordAttualePassword
    );

    if (!verifica.ok) {
      setPasswordError(verifica.error);
      setLoadingPassword(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: nuovaPassword,
    });

    if (error) {
      setPasswordError(
        "Non è stato possibile modificare la password. Riprova."
      );
      setLoadingPassword(false);
      return;
    }

    setPasswordMessage(
      "Password modificata correttamente."
    );

    setPasswordAttualePassword("");
    setNuovaPassword("");
    setConfermaPassword("");

    setLoadingPassword(false);
  };

  if (loadingUser) {
    return (
      <main className="loadingPage">
        Caricamento profilo...
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <header className="pageHeader">
          <div>
            <span className="eyebrow">ACCOUNT</span>

            <h1>👤 Il mio profilo</h1>

            <p>
              Gestisci i dati di accesso al tuo account.
            </p>
          </div>

          <Link href="/" className="backButton">
            ← Home
          </Link>
        </header>

        <section className="card accountCard">
          <span className="sectionIcon">📧</span>

          <div>
            <span className="label">
              Email attuale
            </span>

            <strong className="currentEmail">
              {email || "—"}
            </strong>
          </div>
        </section>

        <section className="card">
          <div className="sectionHeader">
            <div>
              <span className="sectionIcon">✉️</span>

              <h2>Modifica email</h2>

              <p>
                Per sicurezza, inserisci la password
                attuale prima di modificare l'indirizzo.
              </p>
            </div>
          </div>

          <form onSubmit={cambiaEmail} className="form">
            <label>
              Nuova email

              <input
                type="email"
                value={nuovaEmail}
                onChange={(event) =>
                  setNuovaEmail(event.target.value)
                }
                placeholder="nuova@email.it"
                autoComplete="email"
                required
              />
            </label>

            <label>
              Password attuale

              <input
                type="password"
                value={passwordAttualeEmail}
                onChange={(event) =>
                  setPasswordAttualeEmail(event.target.value)
                }
                placeholder="Password attuale"
                autoComplete="current-password"
                required
              />
            </label>

            {emailError && (
              <div className="error">
                {emailError}
              </div>
            )}

            {emailMessage && (
              <div className="success">
                {emailMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loadingEmail}
            >
              {loadingEmail
                ? "Verifica e modifica..."
                : "Modifica email"}
            </button>
          </form>
        </section>

        <section className="card">
          <div className="sectionHeader">
            <div>
              <span className="sectionIcon">🔐</span>

              <h2>Modifica password</h2>

              <p>
                Inserisci la password attuale e scegli
                una nuova password.
              </p>
            </div>
          </div>

          <form onSubmit={cambiaPassword} className="form">
            <label>
              Password attuale

              <input
                type="password"
                value={passwordAttualePassword}
                onChange={(event) =>
                  setPasswordAttualePassword(
                    event.target.value
                  )
                }
                placeholder="Password attuale"
                autoComplete="current-password"
                required
              />
            </label>

            <label>
              Nuova password

              <input
                type="password"
                value={nuovaPassword}
                onChange={(event) =>
                  setNuovaPassword(event.target.value)
                }
                placeholder="Almeno 8 caratteri"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>

            <label>
              Conferma nuova password

              <input
                type="password"
                value={confermaPassword}
                onChange={(event) =>
                  setConfermaPassword(event.target.value)
                }
                placeholder="Ripeti la nuova password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>

            {passwordError && (
              <div className="error">
                {passwordError}
              </div>
            )}

            {passwordMessage && (
              <div className="success">
                {passwordMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loadingPassword}
            >
              {loadingPassword
                ? "Verifica e modifica..."
                : "Modifica password"}
            </button>
          </form>
        </section>

        <footer>
          <Link href="/">← Torna al terrazzo</Link>
        </footer>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background: #f4f6f1;
          color: #263126;
          font-family: Arial, Helvetica, sans-serif;
          padding: 30px 20px 50px;
        }

        .loadingPage {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f4f6f1;
          color: #55745b;
          font-family: Arial, Helvetica, sans-serif;
        }

        .container {
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
        }

        .pageHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 25px;
        }

        .eyebrow {
          color: #55745b;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.4px;
        }

        h1 {
          margin: 7px 0 8px;
          color: #354d3b;
          font-size: 32px;
        }

        .pageHeader p {
          margin: 0;
          color: #687168;
          line-height: 1.5;
        }

        .backButton {
          flex-shrink: 0;
          padding: 11px 15px;
          border: 1px solid #d9e0d5;
          border-radius: 14px;
          background: #fffdf8;
          color: #354d3b;
          text-decoration: none;
          font-weight: 700;
        }

        .card {
          background: #fffdf8;
          border: 1px solid #e8dfcf;
          border-radius: 24px;
          padding: 25px;
          margin-bottom: 18px;
          box-shadow: 0 8px 24px rgba(50, 70, 50, 0.06);
        }

        .accountCard {
          display: flex;
          align-items: center;
          gap: 16px;
          background: #e9f1e5;
          border-color: #d8e6d2;
        }

        .sectionIcon {
          font-size: 30px;
        }

        .label {
          display: block;
          color: #687168;
          font-size: 13px;
          margin-bottom: 4px;
        }

        .currentEmail {
          display: block;
          color: #354d3b;
          font-size: 17px;
          word-break: break-word;
        }

        .sectionHeader {
          margin-bottom: 20px;
        }

        h2 {
          display: inline;
          margin: 0 0 0 10px;
          color: #354d3b;
          font-size: 22px;
          vertical-align: middle;
        }

        .sectionHeader p {
          margin: 10px 0 0;
          color: #687168;
          line-height: 1.5;
          font-size: 14px;
        }

        .form {
          display: grid;
          gap: 15px;
        }

        label {
          display: grid;
          gap: 7px;
          color: #354d3b;
          font-weight: 700;
          font-size: 14px;
        }

        input {
          width: 100%;
          padding: 13px 14px;
          border: 1px solid #d8d0c0;
          border-radius: 12px;
          background: white;
          color: #263126;
          font-size: 15px;
          outline: none;
        }

        input:focus {
          border-color: #55745b;
          box-shadow: 0 0 0 3px rgba(85, 116, 91, 0.1);
        }

        button {
          width: 100%;
          padding: 13px;
          border: none;
          border-radius: 12px;
          background: #55745b;
          color: white;
          cursor: pointer;
          font-size: 16px;
          font-weight: 700;
        }

        button:hover:not(:disabled) {
          background: #46644c;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error,
        .success {
          padding: 12px;
          border-radius: 10px;
          font-size: 14px;
          line-height: 1.45;
        }

        .error {
          background: #fff0ed;
          color: #b42318;
        }

        .success {
          background: #edf7ee;
          color: #35643b;
        }

        footer {
          text-align: center;
          margin-top: 25px;
        }

        footer a {
          color: #55745b;
          font-weight: 700;
          text-decoration: none;
        }

        @media (max-width: 560px) {
          .page {
            padding: 20px 15px 35px;
          }

          .pageHeader {
            align-items: center;
          }

          h1 {
            font-size: 27px;
          }

          .backButton {
            padding: 9px 12px;
            font-size: 13px;
          }

          .card {
            padding: 20px;
          }
        }
      `}</style>
    </main>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

function LoginForm() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (event) => {
    event.preventDefault();

    setLoading(true);
    setErrore("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrore(error.message);
      setLoading(false);
      return;
    }

    const redirect = searchParams.get("redirect") || "/";

    window.location.href = redirect;
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
          <div style={{ fontSize: "48px" }}>🌿</div>

          <h1
            style={{
              color: "#354d3b",
              margin: "10px 0 6px",
            }}
          >
            Il Terrazzo di Ivan & Arturo
          </h1>

          <p style={{ color: "#687168", margin: 0 }}>
            Accedi al tuo angolo verde
          </p>
        </div>

        <form
          onSubmit={login}
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
              style={inputStyle}
            />
          </label>

          <label
            style={{
              color: "#354d3b",
              fontWeight: "600",
            }}
          >
            Password

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={inputStyle}
            />
          </label>

          <div
            style={{
              textAlign: "right",
              marginTop: "-5px",
            }}
          >
            <Link
              href="/recupero-password"
              style={{
                color: "#55745b",
                fontSize: "14px",
                textDecoration: "none",
                fontWeight: "600",
              }}
            >
              Hai dimenticato la password?
            </Link>
          </div>

          {errore && (
            <div
              style={{
                background: "#fff0ed",
                color: "#b42318",
                padding: "12px",
                borderRadius: "10px",
                fontSize: "14px",
              }}
            >
              {errore}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px",
              border: "none",
              borderRadius: "12px",
              background: "#55745b",
              color: "white",
              cursor: loading ? "default" : "pointer",
              fontWeight: "600",
              fontSize: "16px",
              marginTop: "6px",
            }}
          >
            {loading ? "Accesso..." : "Accedi"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f4f6f1",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          Caricamento...
        </main>
      }
    >
      <LoginForm />
    </Suspense>
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

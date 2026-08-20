"use client";

import { useEffect, useRef, useState } from "react";

export default function DiagnosiAI() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState("");

  useEffect(() => {
    return () => stopCamera();
  }, []);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOpen(false);
  }

  async function startCamera() {
    setCameraError("");
    setCameraReady(false);

    if (!window.isSecureContext) {
      setCameraError(
        "La fotocamera richiede una connessione sicura (HTTPS)."
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Il browser non permette l'accesso alla fotocamera. Puoi comunque caricare una foto."
      );
      return;
    }

    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraOpen(true);

      const video = videoRef.current;

      if (video) {
        video.srcObject = stream;

        const markReady = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            setCameraReady(true);
          }
        };

        video.onloadedmetadata = async () => {
          try {
            await video.play();
            markReady();
          } catch (error) {
            console.error("Errore avvio video:", error);
          }
        };

        video.oncanplay = markReady;
        video.onplaying = markReady;

        try {
          await video.play();
          markReady();
        } catch (error) {
          console.error("Errore avvio video:", error);
        }
      }
    } catch (error) {
      console.error("Errore fotocamera:", error);

      let message =
        "Impossibile inizializzare la fotocamera.";

      if (error?.name === "NotAllowedError") {
        message =
          "Accesso alla fotocamera negato. Consenti l'accesso alla webcam nelle autorizzazioni del browser e riprova.";
      } else if (error?.name === "NotFoundError") {
        message =
          "Non è stata trovata nessuna fotocamera disponibile su questo dispositivo.";
      } else if (error?.name === "NotReadableError") {
        message =
          "La fotocamera è già utilizzata da un'altra applicazione.";
      } else if (error?.name === "SecurityError") {
        message =
          "Il browser ha bloccato l'accesso alla fotocamera per motivi di sicurezza.";
      }

      setCameraError(message);
      stopCamera();
    }
  }

  function takePhoto() {
    const video = videoRef.current;

    if (
      !video ||
      !cameraReady ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      setCameraError(
        "La fotocamera non è ancora pronta. Attendi un momento."
      );
      return;
    }

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError(
            "Non è stato possibile acquisire la fotografia."
          );
          return;
        }

        const file = new File(
          [blob],
          `diagnosi-${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );

        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(file));
        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  }

  function handleFile(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setCameraError("Seleziona un'immagine valida.");
      return;
    }

    setCameraError("");
    setDiagnosis("");
    setCameraReady(false);
    stopCamera();

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handleFileInput(event) {
    handleFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function removePhoto() {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhoto(null);
    setPhotoPreview("");
    setDiagnosis("");
    setCameraError("");
  }

  async function analyzePhoto() {
    if (!photo) return;

    setLoading(true);
    setDiagnosis("");
    setCameraError("");

    try {
      const formData = new FormData();
      formData.append("image", photo);

      const response = await fetch("/api/diagnosi-ai", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Errore durante l'analisi."
        );
      }

      setDiagnosis(
        result.diagnosis ||
          result.result ||
          "L'AI non ha restituito una diagnosi."
      );
    } catch (error) {
      console.error(error);

      setCameraError(
        error.message || "Errore durante l'analisi."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f6f1",
        color: "#263126",
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: "28px 20px 45px",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <button
          onClick={() => {
            window.location.href = "/";
          }}
          style={{
            border: "1px solid #d9e0d5",
            background: "#fffdf8",
            color: "#354d3b",
            borderRadius: 14,
            padding: "11px 15px",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          ← Home
        </button>

        <section
          style={{
            marginTop: 25,
            padding: 28,
            borderRadius: 24,
            background: "#f5f1df",
            border: "1px solid #e9e1c6",
          }}
        >
          <div
            style={{
              color: "#55745b",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.4,
            }}
          >
            ANALISI DELLA PIANTA
          </div>

          <h1
            style={{
              color: "#354d3b",
              fontSize: 30,
              margin: "8px 0 10px",
            }}
          >
            🔬 Diagnosi AI
          </h1>

          <p
            style={{
              color: "#687168",
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            Scatta una fotografia oppure caricane una
            esistente. L'intelligenza artificiale analizzerà
            l'immagine per individuare possibili patologie,
            parassiti o altri problemi della pianta.
          </p>
        </section>

        {!cameraOpen && !photo && (
          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 18,
              marginTop: 25,
            }}
          >
            <button
              onClick={startCamera}
              style={{
                minHeight: 190,
                borderRadius: 24,
                border: "1px solid #d8e6d2",
                background: "#e9f1e5",
                color: "#354d3b",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
              }}
            >
              <span style={{ fontSize: 48 }}>📷</span>
              <strong style={{ fontSize: 18 }}>
                Scatta una foto
              </strong>
              <small>
                Usa la fotocamera del dispositivo
              </small>
            </button>

            <button
              onClick={() =>
                fileInputRef.current?.click()
              }
              style={{
                minHeight: 190,
                borderRadius: 24,
                border: "1px solid #d5e5ea",
                background: "#e9f2f5",
                color: "#354d3b",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
              }}
            >
              <span style={{ fontSize: 48 }}>🖼️</span>
              <strong style={{ fontSize: 18 }}>
                Carica una foto
              </strong>
              <small>
                Scegli un'immagine dal dispositivo
              </small>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              hidden
            />
          </section>
        )}

        {cameraOpen && (
          <section
            style={{
              marginTop: 25,
              padding: 20,
              borderRadius: 24,
              background: "#fffdf8",
              border: "1px solid #e8dfcf",
            }}
          >
            <h2 style={{ color: "#354d3b" }}>
              Inquadra la parte della pianta
            </h2>

            <div
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 20,
                background: "#172018",
                width: "100%",
                aspectRatio: "16 / 9",
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
                marginTop: 18,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={takePhoto}
                disabled={!cameraReady}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  border: "6px solid white",
                  background: "#354d3b",
                  color: "white",
                  cursor: cameraReady ? "pointer" : "wait",
                  fontSize: 28,
                  opacity: cameraReady ? 1 : 0.5,
                }}
              >
                {cameraReady ? "📷" : "⏳"}
              </button>

              <button
                onClick={stopCamera}
                style={{
                  border: "1px solid #d9e0d5",
                  background: "#f7f8f4",
                  color: "#354d3b",
                  borderRadius: 13,
                  padding: "12px 18px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Annulla
              </button>
            </div>
          </section>
        )}

        {!cameraOpen && photo && (
          <section
            style={{
              marginTop: 25,
              padding: 20,
              borderRadius: 24,
              background: "#fffdf8",
              border: "1px solid #e8dfcf",
            }}
          >
            <h2 style={{ color: "#354d3b" }}>
              Fotografia pronta
            </h2>

            <img
              src={photoPreview}
              alt="Pianta da analizzare"
              style={{
                display: "block",
                width: "100%",
                maxHeight: 600,
                objectFit: "contain",
                borderRadius: 18,
                background: "#edf0eb",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 18,
              }}
            >
              <button
                onClick={removePhoto}
                style={{
                  border: "1px solid #d9e0d5",
                  background: "#f7f8f4",
                  color: "#354d3b",
                  borderRadius: 13,
                  padding: "12px 16px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ✕ Cambia foto
              </button>

              <button
                onClick={analyzePhoto}
                disabled={loading}
                style={{
                  border: "1px solid #c7d9c0",
                  background: "#354d3b",
                  color: "white",
                  borderRadius: 13,
                  padding: "12px 18px",
                  cursor: loading
                    ? "wait"
                    : "pointer",
                  fontWeight: 700,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading
                  ? "🔄 Analisi in corso..."
                  : "🤖 Analizza con AI"}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              hidden
            />
          </section>
        )}

        {cameraError && (
          <div
            style={{
              marginTop: 18,
              padding: 15,
              borderRadius: 14,
              background: "#fff0ed",
              border: "1px solid #efd0c8",
              color: "#8b4338",
              lineHeight: 1.5,
            }}
          >
            ⚠️ {cameraError}
          </div>
        )}

        {diagnosis && (
          <section
            style={{
              marginTop: 25,
              padding: 24,
              borderRadius: 24,
              background: "#fffdf8",
              border: "1px solid #d8e6d2",
            }}
          >
            <div
              style={{
                color: "#55745b",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1.4,
              }}
            >
              RISULTATO DELL'ANALISI
            </div>

            <h2 style={{ color: "#354d3b" }}>
              🤖 Diagnosi AI
            </h2>

            <div
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: 1.7,
                color: "#3d473f",
              }}
            >
              {diagnosis}
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 15,
                borderRadius: 14,
                background: "#f4f6f1",
                color: "#687168",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              🌱 <strong>Nota:</strong> la diagnosi è
              generata dall'intelligenza artificiale ed è
              un'indicazione orientativa.
            </div>
          </section>
        )}

        <footer
          style={{
            marginTop: 35,
            paddingTop: 20,
            borderTop: "1px solid #dde2d9",
            color: "#7b837c",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          Il Terrazzo di Ivan & Arturo · Diagnosi AI
        </footer>
      </div>
    </main>
  );
}

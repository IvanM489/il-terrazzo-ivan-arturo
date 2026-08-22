"use client";

import { useEffect, useRef, useState } from "react";

export default function DiagnosiAI() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState("");

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraOpen(false);
    setCameraReady(false);
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

      // Su iPhone/Safari è più affidabile chiedere inizialmente
      // una fotocamera generica e poi selezionare quella posteriore.
      let stream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
          },
          audio: false,
        });
      } catch (firstError) {
        console.error("Tentativo fotocamera posteriore fallito:", firstError);

        // Fallback: richiesta generica della fotocamera.
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      // IMPORTANTE:
      // prima montiamo il pannello camera, poi un useEffect
      // collegherà lo stream al video.
      setCameraOpen(true);

    } catch (error) {
      console.error("Errore fotocamera:", error);

      let message = "Impossibile inizializzare la fotocamera.";

      if (error?.name === "NotAllowedError") {
        message =
          "Accesso alla fotocamera negato. Su iPhone vai in Impostazioni → Safari → Fotocamera e consenti l'accesso per questo sito.";
      } else if (error?.name === "NotFoundError") {
        message =
          "Non è stata trovata nessuna fotocamera disponibile.";
      } else if (error?.name === "NotReadableError") {
        message =
          "La fotocamera è già utilizzata da un'altra applicazione.";
      } else if (error?.name === "OverconstrainedError") {
        message =
          "La fotocamera posteriore non è disponibile con queste impostazioni. Riprova.";
      } else if (error?.name === "SecurityError") {
        message =
          "Safari ha bloccato l'accesso alla fotocamera per motivi di sicurezza.";
      }

      setCameraError(message);
      stopCamera();
    }
  }

  useEffect(() => {
    if (!cameraOpen) return;

    const video = videoRef.current;
    const stream = streamRef.current;

    if (!video || !stream) return;

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

    const timer = setTimeout(async () => {
      try {
        await video.play();
        markReady();
      } catch (error) {
        console.error("Errore play video:", error);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.oncanplay = null;
      video.onplaying = null;
    };
  }, [cameraOpen]);

  function takePhoto() {
    const video = videoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError(
        "La fotocamera non ha ancora fornito un'immagine. Attendi un momento."
      );
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      setCameraError(
        "Impossibile preparare la fotografia."
      );
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError(
        "Impossibile acquisire la fotografia."
      );
      return;
    }

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
          {
            type: "image/jpeg",
          }
        );

        if (photoPreview) {
          URL.revokeObjectURL(photoPreview);
        }

        setPhoto(file);
        setPhotoPreview(
          URL.createObjectURL(file)
        );

        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  }

  function handleFile(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setCameraError(
        "Seleziona un'immagine valida."
      );
      return;
    }

    setCameraError("");
    setDiagnosis("");
    stopCamera();

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhoto(file);
    setPhotoPreview(
      URL.createObjectURL(file)
    );
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
      const compressedFile = await compressImage(photo);

      const formData = new FormData();
      formData.append("image", compressedFile);

      const response = await fetch(
        "/api/diagnosi-ai",
        {
          method: "POST",
          body: formData,
        }
      );

      const responseText = await response.text();

      let result;

      try {
        result = JSON.parse(responseText);
      } catch {
        console.error(
          "Risposta non JSON dall'API diagnosi:",
          response.status,
          responseText
        );

        throw new Error(
          `Errore del server (${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Errore durante l'analisi."
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
        error.message ||
          "Errore durante l'analisi."
      );
    } finally {
      setLoading(false);
    }
  }

  async function compressImage(file) {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = objectUrl;
      });

      const maxSize = 1600;

      let width = image.naturalWidth;
      let height = image.naturalHeight;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round(
            height * maxSize / width
          );
          width = maxSize;
        } else {
          width = Math.round(
            width * maxSize / height
          );
          height = maxSize;
        }
      }

      const canvas = document.createElement("canvas");

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error(
          "Impossibile preparare la fotografia."
        );
      }

      context.drawImage(
        image,
        0,
        0,
        width,
        height
      );

      const blob = await new Promise((resolve) => {
        canvas.toBlob(
          resolve,
          "image/jpeg",
          0.82
        );
      });

      if (!blob) {
        throw new Error(
          "Non è stato possibile preparare la fotografia."
        );
      }

      console.log(
        "Foto diagnosi compressa:",
        Math.round(file.size / 1024),
        "KB →",
        Math.round(blob.size / 1024),
        "KB"
      );

      return new File(
        [blob],
        "diagnosi-ai.jpg",
        {
          type: "image/jpeg",
        }
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f6f1",
        color: "#263126",
        fontFamily:
          "Arial, Helvetica, sans-serif",
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
            border:
              "1px solid #e9e1c6",
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
            Scatta una fotografia oppure
            caricane una esistente.
            L'intelligenza artificiale
            analizzerà l'immagine per
            individuare possibili patologie,
            parassiti o altri problemi della
            pianta.
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
                border:
                  "1px solid #d8e6d2",
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
              <span
                style={{ fontSize: 48 }}
              >
                📷
              </span>

              <strong
                style={{ fontSize: 18 }}
              >
                Scatta una foto
              </strong>

              <small>
                Usa la fotocamera posteriore
              </small>
            </button>

            <button
              onClick={() =>
                fileInputRef.current?.click()
              }
              style={{
                minHeight: 190,
                borderRadius: 24,
                border:
                  "1px solid #d5e5ea",
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
              <span
                style={{ fontSize: 48 }}
              >
                🖼️
              </span>

              <strong
                style={{ fontSize: 18 }}
              >
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
              border:
                "1px solid #e8dfcf",
            }}
          >
            <h2
              style={{
                color: "#354d3b",
              }}
            >
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

            <canvas
              ref={canvasRef}
              style={{
                display: "none",
              }}
            />

            <div
              style={{
                textAlign: "center",
                marginTop: 12,
                color: "#687168",
                fontSize: 13,
              }}
            >
              {cameraReady
                ? "📷 Fotocamera posteriore pronta"
                : "⏳ Avvio fotocamera..."}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent:
                  "center",
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
                  border:
                    "6px solid white",
                  background: "#354d3b",
                  color: "white",
                  cursor:
                    cameraReady
                      ? "pointer"
                      : "wait",
                  fontSize: 28,
                  opacity:
                    cameraReady ? 1 : 0.5,
                }}
              >
                {cameraReady
                  ? "📷"
                  : "⏳"}
              </button>

              <button
                onClick={stopCamera}
                style={{
                  border:
                    "1px solid #d9e0d5",
                  background: "#f7f8f4",
                  color: "#354d3b",
                  borderRadius: 13,
                  padding:
                    "12px 18px",
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
              border:
                "1px solid #e8dfcf",
            }}
          >
            <h2
              style={{
                color: "#354d3b",
              }}
            >
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
                justifyContent:
                  "center",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 18,
              }}
            >
              <button
                onClick={removePhoto}
                style={{
                  border:
                    "1px solid #d9e0d5",
                  background: "#f7f8f4",
                  color: "#354d3b",
                  borderRadius: 13,
                  padding:
                    "12px 16px",
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
                  border:
                    "1px solid #c7d9c0",
                  background: "#354d3b",
                  color: "white",
                  borderRadius: 13,
                  padding:
                    "12px 18px",
                  cursor: loading
                    ? "wait"
                    : "pointer",
                  fontWeight: 700,
                  opacity:
                    loading ? 0.6 : 1,
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
              border:
                "1px solid #efd0c8",
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
              border:
                "1px solid #d8e6d2",
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

            <h2
              style={{
                color: "#354d3b",
              }}
            >
              🤖 Diagnosi AI
            </h2>

            <div
              style={{
                whiteSpace:
                  "pre-wrap",
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
              🌱 <strong>Nota:</strong>{" "}
              la diagnosi è generata
              dall'intelligenza artificiale
              ed è un'indicazione
              orientativa.
            </div>
          </section>
        )}

        <footer
          style={{
            marginTop: 35,
            paddingTop: 20,
            borderTop:
              "1px solid #dde2d9",
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

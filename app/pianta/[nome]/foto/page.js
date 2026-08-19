"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

export default function PlantPhotosPage() {
  const params = useParams();
  const nome = decodeURIComponent(params.nome);

  const [plant, setPlant] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href =
            `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          return;
        }

        let foundPlant = null;
        let plantType = null;

        const sources = [
          ["plants", "plants"],
          ["indoor_plants", "indoor_plants"],
          ["bonsai", "bonsai"],
        ];

        for (const [table, type] of sources) {
          const { data } = await supabase
            .from(table)
            .select("*")
            .eq("name", nome)
            .maybeSingle();

          if (data) {
            foundPlant = data;
            plantType = type;
            break;
          }
        }

        if (!foundPlant) {
          setError("Pianta non trovata.");
          setLoading(false);
          return;
        }

        setPlant({
          ...foundPlant,
          plantType,
        });

        const response = await fetch(
          `/api/plant-photos?plantId=${encodeURIComponent(
            foundPlant.id
          )}&plantType=${encodeURIComponent(plantType)}`
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Errore nel caricamento delle foto."
          );
        }

        setPhotos(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [nome]);

  async function refreshPhotos() {
    if (!plant) return;

    const response = await fetch(
      `/api/plant-photos?plantId=${encodeURIComponent(
        plant.id
      )}&plantType=${encodeURIComponent(plant.plantType)}`
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Errore nell'aggiornamento delle foto."
      );
    }

    setPhotos(result);

    if (result.length > 0) {
      setCurrent(result.length - 1);
    } else {
      setCurrent(0);
    }
  }

  async function uploadPhotoFile(file) {
    if (!file || !plant) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("plantId", plant.id);
      formData.append("plantType", plant.plantType);

      const response = await fetch("/api/plant-photos", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Errore durante il caricamento."
        );
      }

      await refreshPhotos();

      if (capturedPhoto?.previewUrl) {
        URL.revokeObjectURL(capturedPhoto.previewUrl);
      }

      setCapturedPhoto(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    await uploadPhotoFile(file);

    event.target.value = "";
  }

  async function startCamera() {
    setCameraError("");
    setCapturedPhoto(null);
    setCameraReady(false);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "La fotocamera non è supportata da questo browser."
        );
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "environment",
          },
          width: {
            ideal: 1920,
          },
          height: {
            ideal: 1080,
          },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          videoRef.current
            .play()
            .then(() => {
              setCameraReady(true);
            })
            .catch(() => {
              setCameraReady(true);
            });
        }
      }, 100);
    } catch (err) {
      console.error(err);

      if (err.name === "NotAllowedError") {
        setCameraError(
          "Permesso fotocamera negato. Consenti l'accesso alla fotocamera nel browser e riprova."
        );
      } else if (err.name === "NotFoundError") {
        setCameraError(
          "Nessuna fotocamera disponibile sul dispositivo."
        );
      } else {
        setCameraError(
          "Impossibile accedere alla fotocamera. Controlla i permessi del browser."
        );
      }
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOpen(false);
    setCameraReady(false);
    setCameraError("");
  }

  function takePhoto() {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      setCameraError(
        "La fotocamera non è ancora pronta. Attendi un secondo e riprova."
      );
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    context.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError(
            "Errore nella creazione della fotografia."
          );
          return;
        }

        const previewUrl = URL.createObjectURL(blob);

        setCapturedPhoto({
          blob,
          previewUrl,
        });

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => {
            track.stop();
          });
        }

        streamRef.current = null;
        setCameraReady(false);
      },
      "image/jpeg",
      0.92
    );
  }

  function retakePhoto() {
    if (capturedPhoto?.previewUrl) {
      URL.revokeObjectURL(capturedPhoto.previewUrl);
    }

    setCapturedPhoto(null);
    setCameraError("");

    startCamera();
  }

  async function useCapturedPhoto() {
    if (!capturedPhoto?.blob) return;

    const file = new File(
      [capturedPhoto.blob],
      `foto-${Date.now()}.jpg`,
      {
        type: "image/jpeg",
      }
    );

    await uploadPhotoFile(file);

    stopCamera();
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, []);

  async function deletePhoto(photo) {
    if (!window.confirm("Vuoi eliminare questa fotografia?")) {
      return;
    }

    setError("");

    const response = await fetch("/api/plant-photos", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: photo.id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(
        result.error || "Errore durante l'eliminazione."
      );
      return;
    }

    const updated = photos.filter(
      (item) => item.id !== photo.id
    );

    setPhotos(updated);

    setCurrent((value) =>
      Math.min(value, Math.max(0, updated.length - 1))
    );
  }

  function previous() {
    setCurrent((value) => Math.max(0, value - 1));
  }

  function next() {
    setCurrent((value) =>
      Math.min(photos.length - 1, value + 1)
    );
  }

  if (loading) {
    return (
      <main className="center">
        Caricamento...
      </main>
    );
  }

  if (!plant) {
    return (
      <main className="center">
        <p>{error || "Pianta non trovata."}</p>

        <Link href="/piante">
          ← Torna alle piante
        </Link>
      </main>
    );
  }

  const photo = photos[current];

  return (
    <main className="page">
      <header className="top">
        <Link
          href={`/pianta/${encodeURIComponent(nome)}`}
        >
          ← Torna alla scheda
        </Link>

        <div>
          <span>📷</span>
          <h1>Fotografie</h1>
          <p>{plant.name}</p>
        </div>
      </header>

      {error && (
        <div className="error">
          ⚠️ {error}
        </div>
      )}

      <section className="gallery">
        {photos.length === 0 ? (
          <div className="empty">
            <div className="emptyIcon">📷</div>

            <h2>Nessuna fotografia</h2>

            <p>
              Questa pianta non ha ancora fotografie.
            </p>
          </div>
        ) : (
          <>
            <div className="photoArea">
              <button
                className="arrow"
                onClick={previous}
                disabled={current === 0}
                aria-label="Foto precedente"
              >
                ←
              </button>

              <div className="photoFrame">
                {photo?.url && (
                  <img
                    src={photo.url}
                    alt={photo.caption || plant.name}
                  />
                )}

                {photo?.caption && (
                  <p>{photo.caption}</p>
                )}
              </div>

              <button
                className="arrow"
                onClick={next}
                disabled={
                  current === photos.length - 1
                }
                aria-label="Foto successiva"
              >
                →
              </button>
            </div>

            <div className="counter">
              {current + 1} di {photos.length}
            </div>

            <button
              className="deleteButton"
              onClick={() => deletePhoto(photo)}
            >
              🗑️ Elimina questa foto
            </button>
          </>
        )}
      </section>

      <section className="upload">
        <h2>📸 Aggiungi una fotografia</h2>

        <div className="uploadActions">
          <label className="uploadButton">
            {uploading
              ? "Caricamento..."
              : "📁 Scegli una fotografia"}

            <input
              type="file"
              accept="image/*"
              onChange={uploadPhoto}
              disabled={uploading}
            />
          </label>

          <button
            className="cameraButton"
            onClick={startCamera}
            disabled={uploading}
          >
            📷 Scatta una fotografia
          </button>
        </div>

        <p>
          Puoi scegliere una fotografia già presente
          sul dispositivo oppure scattarne una nuova
          direttamente con la fotocamera.
        </p>
      </section>

      {cameraOpen && (
        <div className="cameraOverlay">
          <div className="cameraModal">
            <div className="cameraHeader">
              <div>
                <h2>📷 Scatta una fotografia</h2>
                <p>{plant.name}</p>
              </div>

              <button
                className="closeCamera"
                onClick={stopCamera}
                aria-label="Chiudi fotocamera"
              >
                ✕
              </button>
            </div>

            {cameraError && (
              <div className="cameraError">
                ⚠️ {cameraError}
              </div>
            )}

            {!capturedPhoto ? (
              <>
                <div className="cameraView">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                  />

                  {!cameraReady && !cameraError && (
                    <div className="cameraLoading">
                      <div className="spinner"></div>
                      <p>Avvio fotocamera...</p>
                    </div>
                  )}

                  <div className="cameraGuide"></div>
                </div>

                <canvas
                  ref={canvasRef}
                  className="hiddenCanvas"
                />

                <div className="cameraControls">
                  <button
                    className="cancelButton"
                    onClick={stopCamera}
                  >
                    Annulla
                  </button>

                  <button
                    className="shutterButton"
                    onClick={takePhoto}
                    disabled={!cameraReady}
                    aria-label="Scatta fotografia"
                  >
                    <span></span>
                  </button>

                  <div className="cameraSpacer"></div>
                </div>
              </>
            ) : (
              <>
                <div className="capturedView">
                  <img
                    src={capturedPhoto.previewUrl}
                    alt="Anteprima fotografia"
                  />
                </div>

                <div className="capturedActions">
                  <button
                    className="retakeButton"
                    onClick={retakePhoto}
                    disabled={uploading}
                  >
                    🔄 Scatta di nuovo
                  </button>

                  <button
                    className="usePhotoButton"
                    onClick={useCapturedPhoto}
                    disabled={uploading}
                  >
                    {uploading
                      ? "Caricamento..."
                      : "✅ Usa questa foto"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          width: 100%;
          box-sizing: border-box;
          background: #f4f6f1 !important;
          color: #354d3b;
          padding: 25px 20px 50px;
          font-family: Arial, Helvetica, sans-serif;
        }

        .top {
          max-width: 1100px;
          margin: 0 auto 25px;
        }

        .top a {
          color: #55745b;
          text-decoration: none;
          font-weight: 700;
        }

        .top div {
          text-align: center;
          margin-top: 25px;
        }

        .top span {
          font-size: 42px;
        }

        h1 {
          margin: 5px 0;
          font-size: 34px;
        }

        .top p {
          color: #687168;
          margin-top: 5px;
        }

        .gallery {
          max-width: 1100px;
          margin: 0 auto;
          text-align: center;
        }

        .photoArea {
          display: grid;
          grid-template-columns: 70px 1fr 70px;
          align-items: center;
          gap: 15px;
        }

        .photoFrame {
          min-height: 55vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .photoFrame img {
          max-width: 100%;
          max-height: 68vh;
          object-fit: contain;
          border-radius: 16px;
          box-shadow: 0 15px 50px rgba(0, 0, 0, 0.45);
        }

        .photoFrame p {
          color: #687168;
          margin-top: 15px;
        }

        .arrow {
          width: 58px;
          height: 58px;
          border: 1px solid #d8e0d4;
          border-radius: 50%;
          background: #202820;
          color: #ffffff;
          font-size: 32px;
          cursor: pointer;
        }

        .arrow:disabled {
          opacity: 0.25;
          cursor: default;
        }

        .counter {
          margin-top: 12px;
          color: #354d3b;
          font-size: 16px;
          font-weight: 700;
        }

        .deleteButton {
          margin-top: 18px;
          border: 1px solid #efd0cb;
          background: transparent;
          color: #b42318;
          border-radius: 10px;
          padding: 9px 14px;
          cursor: pointer;
        }

        .upload {
          max-width: 700px;
          margin: 35px auto 0;
          padding: 25px;
          text-align: center;
          background: #fffdf8;
          border: 1px solid #e8dfcf;
          border-radius: 20px;
        }

        .upload h2 {
          margin-top: 0;
        }

        .upload p {
          color: #687168;
          font-size: 13px;
        }

        .uploadActions {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .uploadButton,
        .cameraButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          box-sizing: border-box;
          padding: 12px 18px;
          border-radius: 12px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          font-size: 15px;
          font-family: inherit;
        }

        .uploadButton {
          background: #55745b;
          color: white;
        }

        .uploadButton input {
          display: none;
        }

        .cameraButton {
          background: #354d3b;
          color: white;
        }

        .empty {
          padding: 80px 20px;
          background: #fffdf8;
          border-radius: 24px;
        }

        .emptyIcon {
          font-size: 60px;
        }

        .empty h2 {
          margin-bottom: 5px;
        }

        .empty p {
          color: #687168;
        }

        .error {
          max-width: 900px;
          margin: 0 auto 20px;
          padding: 13px;
          border-radius: 12px;
          background: #fff0ed;
          color: #b42318;
          text-align: center;
        }

        .center {
          min-height: 100vh;
          display: grid;
          place-items: center;
          gap: 10px;
          font-family: Arial, Helvetica, sans-serif;
        }

        .center a {
          color: #55745b;
        }

        .cameraOverlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(20, 27, 21, 0.88);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
          box-sizing: border-box;
        }

        .cameraModal {
          width: min(900px, 100%);
          max-height: 95vh;
          overflow-y: auto;
          background: #fffdf8;
          border-radius: 24px;
          padding: 20px;
          box-sizing: border-box;
          box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
        }

        .cameraHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 15px;
        }

        .cameraHeader h2 {
          margin: 0;
          color: #354d3b;
        }

        .cameraHeader p {
          margin: 5px 0 0;
          color: #687168;
        }

        .closeCamera {
          width: 42px;
          height: 42px;
          border: none;
          border-radius: 50%;
          background: #edf1eb;
          color: #354d3b;
          font-size: 20px;
          cursor: pointer;
        }

        .cameraError {
          margin-bottom: 15px;
          padding: 12px;
          border-radius: 12px;
          background: #fff0ed;
          color: #b42318;
          text-align: center;
        }

        .cameraView {
          position: relative;
          width: 100%;
          background: #111;
          border-radius: 18px;
          overflow: hidden;
          aspect-ratio: 16 / 10;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cameraView video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .cameraGuide {
          position: absolute;
          inset: 7%;
          border: 2px solid rgba(255, 255, 255, 0.55);
          border-radius: 14px;
          pointer-events: none;
        }

        .cameraLoading {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          color: white;
          background: rgba(0, 0, 0, 0.45);
        }

        .spinner {
          width: 38px;
          height: 38px;
          border: 4px solid rgba(255, 255, 255, 0.35);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .hiddenCanvas {
          display: none;
        }

        .cameraControls {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          margin-top: 18px;
        }

        .cancelButton {
          justify-self: start;
          padding: 11px 18px;
          border: 1px solid #d8e0d4;
          border-radius: 12px;
          background: white;
          color: #354d3b;
          font-weight: 700;
          cursor: pointer;
        }

        .shutterButton {
          width: 76px;
          height: 76px;
          border-radius: 50%;
          border: 6px solid white;
          background: #354d3b;
          box-shadow: 0 3px 15px rgba(0, 0, 0, 0.25);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .shutterButton span {
          display: block;
          width: 56px;
          height: 56px;
          background: white;
          border-radius: 50%;
        }

        .shutterButton:disabled {
          opacity: 0.35;
          cursor: default;
        }

        .cameraSpacer {
          width: 80px;
        }

        .capturedView {
          width: 100%;
          background: #111;
          border-radius: 18px;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .capturedView img {
          display: block;
          width: 100%;
          max-height: 65vh;
          object-fit: contain;
        }

        .capturedActions {
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .retakeButton,
        .usePhotoButton {
          border: none;
          border-radius: 12px;
          padding: 13px 20px;
          font-size: 15px;
          font-family: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .retakeButton {
          background: #edf1eb;
          color: #354d3b;
        }

        .usePhotoButton {
          background: #55745b;
          color: white;
        }

        @media (max-width: 650px) {
          .photoArea {
            grid-template-columns: 45px 1fr 45px;
            gap: 5px;
          }

          .arrow {
            width: 42px;
            height: 42px;
            font-size: 23px;
          }

          .photoFrame {
            min-height: 45vh;
          }

          h1 {
            font-size: 28px;
          }

          .uploadActions {
            flex-direction: column;
          }

          .uploadButton,
          .cameraButton {
            width: 100%;
          }

          .cameraOverlay {
            padding: 8px;
          }

          .cameraModal {
            border-radius: 18px;
            padding: 12px;
          }

          .cameraView {
            aspect-ratio: 3 / 4;
          }

          .capturedActions {
            flex-direction: column;
          }

          .retakeButton,
          .usePhotoButton {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [isAdmin, setIsAdmin] = useState(false);

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

        const { data: profile } = await supabase
          .from("profiles")
          .select("ruolo")
          .eq("id", user.id)
          .single();

        setIsAdmin(profile?.ruolo === "admin");

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

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];

    if (!file || !plant) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("plantId", plant.id);
      formData.append("plantType", plant.plantType);

      const response = await fetch(
        "/api/plant-photos",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Errore durante il caricamento."
        );
      }

      const refresh = await fetch(
        `/api/plant-photos?plantId=${encodeURIComponent(
          plant.id
        )}&plantType=${encodeURIComponent(
          plant.plantType
        )}`
      );

      const updated = await refresh.json();

      setPhotos(updated);

      setCurrent(
        Math.max(0, updated.length - 1)
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function deletePhoto(photo) {
    if (
      !window.confirm(
        "Vuoi eliminare questa fotografia?"
      )
    ) {
      return;
    }

    setError("");

    const response = await fetch(
      "/api/plant-photos",
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: photo.id,
        }),
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

    const updated = photos.filter(
      (item) => item.id !== photo.id
    );

    setPhotos(updated);

    setCurrent((value) =>
      Math.min(
        value,
        Math.max(0, updated.length - 1)
      )
    );
  }

  function previous() {
    setCurrent((value) =>
      Math.max(0, value - 1)
    );
  }

  function next() {
    setCurrent((value) =>
      Math.min(
        photos.length - 1,
        value + 1
      )
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
                    alt={
                      photo.caption ||
                      plant.name
                    }
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
              onClick={() =>
                deletePhoto(photo)
              }
            >
              🗑️ Elimina questa foto
            </button>
          </>
        )}
      </section>

      <section className="upload">
        <h2>📤 Aggiungi una fotografia</h2>

        <label className="uploadButton">
          {uploading
            ? "Caricamento..."
            : "📷 Scegli una fotografia"}

          <input
            type="file"
            accept="image/*"
            onChange={uploadPhoto}
            disabled={uploading}
          />
        </label>

        <p>
          Formati immagine supportati. Dimensione massima:
          10 MB.
        </p>
      </section>

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
          box-shadow: 0 15px 50px rgba(0, 0, 0, .45);
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
          color: #354d3b;
          font-size: 32px;
          cursor: pointer;
        }

        .arrow:disabled {
          opacity: .25;
          cursor: default;
        }

        .counter {
          margin-top: 12px;
          color: #d5ddd3;
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

        .uploadButton {
          display: inline-block;
          padding: 12px 18px;
          border-radius: 12px;
          background: #55745b;
          cursor: pointer;
          font-weight: 700;
        }

        .uploadButton input {
          display: none;
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
        }
      `}</style>
    </main>
  );
}

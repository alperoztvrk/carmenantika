import { Star } from "lucide-react";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

function stars(value: number) {
  return Array.from({ length: 5 }, (_, index) => index < value);
}

function initials(firstName: string, lastName: string) {
  return `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toLocaleUpperCase("tr-TR");
}

export function ReviewTicker() {
  const reviews = trpc.review.list.useQuery(undefined, { refetchInterval: 12_000 });
  const items = reviews.data ?? [];
  const rail = useMemo(() => {
    if (items.length === 0) return [];
    let copies = Math.max(6, Math.ceil(8 / items.length));
    if (copies % 2) copies += 1;
    return Array.from({ length: copies }, () => items).flat();
  }, [items]);

  if (rail.length === 0) return null;

  return (
    <div className="review-ticker" id="canli-yorumlar" aria-label="Müşteri yorumları">
      <div className="review-marquee" style={{ "--review-span": `${Math.max(24, items.length * 10)}s` } as React.CSSProperties}>
        <div className="review-rail">
          {rail.map((review, index) => (
            <article className="review-chip" key={`${review.id}-${index}`}>
              <span className="review-initials" aria-hidden>{initials(review.firstName, review.lastName)}</span>
              <div>
                <strong>{review.firstName} {review.lastName}</strong>
                <div className="review-stars" aria-hidden>
                  {stars(review.rating).map((on, star) => (
                    <Star key={star} size={11} fill={on ? "currentColor" : "none"} />
                  ))}
                </div>
                <p>{review.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HomeReviewForm() {
  const utils = trpc.useUtils();
  const create = trpc.review.create.useMutation({
    onSuccess: () => {
      utils.review.list.invalidate();
      setForm({ firstName: "", lastName: "", rating: 5, body: "" });
      setNote("Yorumun yayınlandı. Yukarıdaki bantta kayıyor.");
      window.setTimeout(() => {
        document.getElementById("canli-yorumlar")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 80);
    },
    onError: (error) => setNote(error.message),
  });
  const [form, setForm] = useState({ firstName: "", lastName: "", rating: 5, body: "" });
  const [note, setNote] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setNote("");
    create.mutate(form);
  }

  return (
    <section className="home-reviews" aria-labelledby="reviews-title">
      <div className="container-carmen">
        <form className="review-form" onSubmit={submit}>
          <div>
            <span className="eyebrow">Carmen Antika / Yorumlar</span>
            <h2 id="reviews-title">Bir cümle <em>bırak.</em></h2>
            <p>Adını, puanını ve kısa notunu yaz. Yayınlanınca anasayfanın üst bandında kayar.</p>
          </div>
          <div className="review-form-grid">
            <label>
              Ad
              <input value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} autoComplete="given-name" maxLength={40} required />
            </label>
            <label>
              Soyad
              <input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} autoComplete="family-name" maxLength={40} required />
            </label>
          </div>
          <fieldset className="review-rate">
            <legend>Puan</legend>
            <div>
              {stars(5).map((_, index) => {
                const value = index + 1;
                return (
                  <button
                    key={value}
                    type="button"
                    className={form.rating >= value ? "is-on" : ""}
                    aria-label={`${value} yıldız`}
                    aria-pressed={form.rating === value}
                    onClick={() => setForm((current) => ({ ...current, rating: value }))}
                  >
                    <Star size={20} fill={form.rating >= value ? "currentColor" : "none"} />
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label>
            Yorumun
            <textarea
              rows={4}
              value={form.body}
              maxLength={400}
              required
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              placeholder="Parçanın evindeki hali, teslimat, kondisyon…"
            />
          </label>
          <button className="primary-cta" type="submit" disabled={create.isPending}>
            {create.isPending ? "Gönderiliyor..." : "Yorumu yayınla"}
          </button>
          {note && <p className="review-note">{note}</p>}
        </form>
      </div>
    </section>
  );
}

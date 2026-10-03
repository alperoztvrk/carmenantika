import { Star } from "lucide-react";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

function stars(value: number) {
  return Array.from({ length: 5 }, (_, index) => index < value);
}

function initials(firstName: string, lastName: string) {
  return `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toLocaleUpperCase("tr-TR");
}

export function HomeReviews() {
  const utils = trpc.useUtils();
  const reviews = trpc.review.list.useQuery(undefined, { refetchInterval: 20_000 });
  const create = trpc.review.create.useMutation({
    onSuccess: () => {
      utils.review.list.invalidate();
      setForm({ firstName: "", lastName: "", rating: 5, body: "" });
      setNote("Yorumun yayınlandı. Aşağıda kayarak görünür.");
    },
    onError: (error) => setNote(error.message),
  });
  const [form, setForm] = useState({ firstName: "", lastName: "", rating: 5, body: "" });
  const [note, setNote] = useState("");

  const items = reviews.data ?? [];
  const rail = useMemo(() => (items.length ? [...items, ...items] : []), [items]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setNote("");
    create.mutate(form);
  }

  return (
    <section className="home-reviews" aria-labelledby="reviews-title">
      <div className="container-carmen home-reviews-intro">
        <span className="eyebrow">Carmen Antika / Yorumlar</span>
        <h2 id="reviews-title">Bir cümle <em>bırak.</em></h2>
        <p>Adını, puanını ve kısa notunu yaz. Yorumun canlı olarak bu bantta kayar.</p>
      </div>

      <div className="review-marquee" style={{ "--review-span": `${Math.max(36, items.length * 9)}s` } as React.CSSProperties}>
        {rail.length === 0 ? (
          <p className="review-empty">İlk yorumu sen yaz.</p>
        ) : (
          <div className="review-rail">
            {rail.map((review, index) => (
              <article className="review-card" key={`${review.id}-${index}`}>
                <div className="review-card-top">
                  <span className="review-initials" aria-hidden>{initials(review.firstName, review.lastName)}</span>
                  <div>
                    <strong>{review.firstName} {review.lastName}</strong>
                    <div className="review-stars" aria-label={`${review.rating} yıldız`}>
                      {stars(review.rating).map((on, star) => (
                        <Star key={star} size={13} fill={on ? "currentColor" : "none"} />
                      ))}
                    </div>
                  </div>
                </div>
                <p>{review.body}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="container-carmen">
        <form className="review-form" onSubmit={submit}>
          <div>
            <span className="eyebrow">Yorum bırak</span>
            <h3>Parçayı evine aldın mı?</h3>
            <p>Kısa, dürüst bir not yeter. Puanın ve adın kartta görünür.</p>
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

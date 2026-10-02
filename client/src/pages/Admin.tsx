import { Check, ImagePlus, LogIn, LogOut, PackagePlus, Pencil, Save, ShieldAlert, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { PageRise } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";
import { trpc } from "@/lib/trpc";

function AdminLogin() {
  const utils = trpc.useUtils();
  const status = trpc.auth.localStatus.useQuery();
  const login = trpc.auth.localLogin.useMutation({ onSuccess: () => utils.auth.me.invalidate() });
  const [password, setPassword] = useState("");
  const oauthReady = Boolean(!import.meta.env.PROD && import.meta.env.VITE_OAUTH_PORTAL_URL && import.meta.env.VITE_APP_ID);

  return (
    <StoreLayout>
      <section className="admin-gate container-carmen">
        <div className="admin-gate-brand">
          <span className="eyebrow">Carmen Antika</span>
          <h1>Yönetim <em>girişi.</em></h1>
          <p>Ürün eklemek, görselleri yüklemek ve siparişleri görmek için her seferinde şifrenle gir. Oturum tarayıcı kapanınca biter.</p>
        </div>
        <div className="admin-gate-card">
          <LogIn size={22} />
          <span className="eyebrow">Yalnızca dükkân sahibi</span>
          <h2>Şifre ile devam et</h2>
          <p>Bu sayfa müşterilere kapalıdır. Şifreyi girdikten sonra koleksiyonu ve siparişleri yönetirsin.</p>
          {status.isLoading && <p className="admin-muted">Yönetim alanı açılıyor...</p>}
          {status.data && !status.data.enabled && (
            <p className="admin-message is-error">Yönetim girişi bu sunucuda henüz açık değil. Canlı ortamda yönetim şifresini ekleyip sunucuyu yeniden başlat.</p>
          )}
          {status.data?.enabled && (
            <form onSubmit={(event) => { event.preventDefault(); login.mutate({ password }); }}>
              <label>
                Şifre
                <input
                  type="password"
                  value={password}
                  autoFocus
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Yönetim şifresi"
                />
              </label>
              <button className="admin-submit" type="submit" disabled={login.isPending}>
                {login.isPending ? "Giriliyor..." : "Giriş yap"}
              </button>
              {status.data.passwordHint && (
                <small>Bu bilgisayarda şifre: <strong>{status.data.passwordHint}</strong></small>
              )}
              {login.error && <p className="admin-message is-error">{login.error.message}</p>}
            </form>
          )}
          {oauthReady && <button className="outline-cta" type="button" onClick={() => startLogin()}>Carmen hesabıyla giriş</button>}
        </div>
      </section>
    </StoreLayout>
  );
}

const categoryChoices = ["Radyolar", "Kameralar", "Oyuncaklar", "Objeler", "Kitap & Plak", "Ev & Sofra"];
const emptyForm = { name: "", category: "Objeler", era: "", price: "", shortDescription: "", description: "", condition: "", dimensions: "", imageUrl: "", imageKey: "", tag: "", isAvailable: true, isFeatured: false };
type ProductForm = typeof emptyForm;

function priceToCents(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  return Math.round(Number(normalized) * 100);
}

function toForm(product: any): ProductForm {
  return { name: product.name, category: product.category, era: product.era, price: String(product.priceCents / 100), shortDescription: product.shortDescription, description: product.description, condition: product.condition, dimensions: product.dimensions ?? "", imageUrl: product.imageUrl, imageKey: product.imageKey ?? "", tag: product.tag ?? "", isAvailable: Boolean(product.isAvailable), isFeatured: Boolean(product.isFeatured) };
}

const fieldLabels: Record<string, string> = {
  name: "Ürün adı",
  category: "Kategori",
  era: "Dönem",
  priceCents: "Fiyat",
  shortDescription: "Kısa tanım",
  description: "Açıklama",
  condition: "Kondisyon",
  imageUrl: "Görsel",
};

function readableError(error: { message: string }) {
  try {
    const parsed = JSON.parse(error.message) as Array<{ path?: Array<string | number> }>;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((issue) => `${fieldLabels[String(issue.path?.[0] ?? "")] ?? "Alan"} eksik ya da çok kısa.`).join(" ");
    }
  } catch {
    /* Server sent a plain message. */
  }
  return error.message || "Kayıt tamamlanamadı.";
}

const orderStatusLabel: Record<string, string> = {
  pending: "Ödeme bekleniyor",
  paid: "Ödendi",
  cancelled: "İptal",
  fulfilled: "Teslim edildi",
};

export default function Admin() {
  const utils = trpc.useUtils();
  const { user, loading, loggingOut, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const products = trpc.product.adminList.useQuery(undefined, { enabled: isAdmin });
  const orders = trpc.order.adminList.useQuery(undefined, { enabled: isAdmin, refetchInterval: 5000 });
  const refreshCatalog = () => {
    utils.product.adminList.invalidate();
    utils.product.list.invalidate();
    utils.product.present.invalidate();
    utils.product.getBySlug.invalidate();
  };
  const create = trpc.product.adminCreate.useMutation({ onSuccess: () => { refreshCatalog(); reset(); }, onError: (error) => note(readableError(error), false) });
  const update = trpc.product.adminUpdate.useMutation({ onSuccess: () => { refreshCatalog(); reset(); }, onError: (error) => note(readableError(error), false) });
  const remove = trpc.product.adminDelete.useMutation({
    onSuccess: () => { refreshCatalog(); note("Ürün silindi. Koleksiyondan da kalktı."); },
    onError: (error) => note(readableError(error), false),
  });
  const upload = trpc.product.adminUploadImage.useMutation();
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageOk, setMessageOk] = useState(true);

  function note(text: string, ok = true) { setMessage(text); setMessageOk(ok); }
  function closeEditor() { setForm(emptyForm); setEditingId(null); setMessage(""); }
  function reset() { closeEditor(); note("Ürün kaydedildi. Koleksiyonda görünüyor."); }
  function setField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function handleFile(file?: File) {
    if (!file) return;
    setUploading(true); note("");
    let dataUrl = "";
    try {
      dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const result = await upload.mutateAsync({ fileName: file.name.replace(/[^a-zA-Z0-9._-]/g, "-"), contentType: file.type, dataBase64: dataUrl.split(",")[1] ?? "" });
      setForm((current) => ({ ...current, imageUrl: result.url, imageKey: result.key })); note("Görsel yüklendi.");
    } catch {
      if (dataUrl) { setForm((current) => ({ ...current, imageUrl: dataUrl, imageKey: "" })); note("Görsel bu oturumda yerelde tutuluyor."); }
      else note("Görsel yüklenemedi.", false);
    } finally { setUploading(false); }
  }
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsedPrice = priceToCents(form.price);
    const payload = { name: form.name, category: form.category, era: form.era, priceCents: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 0, shortDescription: form.shortDescription, description: form.description, condition: form.condition, dimensions: form.dimensions || undefined, imageUrl: form.imageUrl, imageKey: form.imageKey || undefined, tag: form.tag || undefined, isAvailable: form.isAvailable ? 1 : 0, isFeatured: form.isFeatured ? 1 : 0 };
    if (editingId) update.mutate({ id: editingId, data: payload }); else create.mutate(payload);
  }
  function removeProduct(id: number) {
    const product = products.data?.find((item) => item.id === id);
    if (!window.confirm(`“${product?.name ?? "Bu parça"}” silinsin mi? Koleksiyondan da kalkar.`)) return;
    if (editingId === id) { setForm(emptyForm); setEditingId(null); }
    remove.mutate({ id });
  }
  const availableCount = useMemo(() => (products.data ?? []).filter((product) => product.isAvailable).length, [products.data]);
  const exitAdmin = () => { void logout(); };

  if (loading && !user) return <div className="admin-state">Yönetim alanı açılıyor...</div>;
  if (!user) return <AdminLogin />;
  if (!isAdmin) return <div className="admin-state"><ShieldAlert size={24} /><h1>Bu alan yalnızca admin içindir.</h1><p>Hesabının ürün yönetimi yetkisi bulunmuyor.</p></div>;

  return (
    <>
      <header className="admin-bar">
        <div className="admin-bar-brand">
          <strong>Carmen Antika</strong>
          <span>Yönetim</span>
        </div>
        <button className="admin-logout" type="button" disabled={loggingOut} onClick={exitAdmin}>
          <LogOut size={18} /> {loggingOut ? "Çıkılıyor..." : "Çıkış yap"}
        </button>
      </header>
      <PageRise>
        <section className="admin-page">
          <div className="container-carmen">
            <div className="admin-heading">
              <div>
                <span className="eyebrow">Carmen Antika / Yönetim</span>
                <h1>Parçalarını <em>yönet.</em></h1>
                <p>Canlı koleksiyona ürün ekle, görsellerini yükle ve satılan parçaları sil.</p>
              </div>
              <div className="admin-heading-tools">
                <div className="admin-stat">
                  <strong>{availableCount}</strong>
                  <span>aktif parça</span>
                </div>
              </div>
            </div>
            <div className="admin-layout">
              <section className="admin-panel admin-form-panel">
                <div className="admin-panel-head">
                  <div>
                    <span className="eyebrow">Ürün editörü</span>
                    <h2>{editingId ? "Parçayı düzenle" : "Yeni parça ekle"}</h2>
                  </div>
                  {editingId && <button className="admin-quiet" type="button" onClick={closeEditor}><X size={15} /> İptal</button>}
                </div>
                <form className="admin-form" onSubmit={handleSubmit}>
                  <label>Ürün adı<input value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="Örn. National Cep Radyosu" /></label>
                  <div className="form-two">
                    <label>Kategori<select value={form.category} onChange={(event) => setField("category", event.target.value)}>{(categoryChoices.indexOf(form.category) === -1 ? [form.category].concat(categoryChoices) : categoryChoices).map((category) => <option key={category}>{category}</option>)}</select></label>
                    <label>Dönem / bilgi<input value={form.era} onChange={(event) => setField("era", event.target.value)} placeholder="1970'ler · çalışır" /></label>
                  </div>
                  <div className="form-two">
                    <label>Fiyat (₺)<input inputMode="decimal" value={form.price} onChange={(event) => setField("price", event.target.value)} placeholder="1250" /></label>
                    <label>Etiket<input value={form.tag} onChange={(event) => setField("tag", event.target.value)} placeholder="Bugün bulundu" /></label>
                  </div>
                  <label>Kısa tanım<input value={form.shortDescription} onChange={(event) => setField("shortDescription", event.target.value)} placeholder="Kartta görünecek kısa cümle" /></label>
                  <label>Hikâyesi / açıklaması<textarea rows={4} value={form.description} onChange={(event) => setField("description", event.target.value)} placeholder="Bu parçayı nerede buldun, neden özel?" /></label>
                  <label>Kondisyon notu<textarea rows={3} value={form.condition} onChange={(event) => setField("condition", event.target.value)} placeholder="Çalışır durumda, yaşına bağlı izler..." /></label>
                  <div className="form-two">
                    <label>Ölçüler<input value={form.dimensions} onChange={(event) => setField("dimensions", event.target.value)} placeholder="18 × 10 × 5 cm" /></label>
                    <label>Görsel yükle<input type="file" accept="image/*" onChange={(event) => handleFile(event.target.files?.[0])} /></label>
                  </div>
                  <div className="upload-box">
                    {form.imageUrl ? <img src={form.imageUrl} alt="Ürün önizleme" /> : <ImagePlus size={22} />}
                    {form.imageUrl ? <span>Görsel hazır</span> : <span>Yüklenen görsel burada görünür</span>}
                    <small>{uploading ? "Yükleniyor..." : "8 MB altında JPG, PNG veya WebP"}</small>
                  </div>
                  <div className="form-checks">
                    <label className="check-option"><input type="checkbox" checked={form.isAvailable} onChange={(event) => setField("isAvailable", event.target.checked)} /><span>Satışta</span></label>
                    <label className="check-option"><input type="checkbox" checked={form.isFeatured} onChange={(event) => setField("isFeatured", event.target.checked)} /><span>Öne çıkar</span></label>
                  </div>
                  <button className="admin-submit" disabled={create.isPending || update.isPending || uploading} type="submit">{editingId ? <><Save size={16} /> Güncelle</> : <><PackagePlus size={16} /> Ürünü yayınla</>}</button>
                  {message && <p className={messageOk ? "admin-message" : "admin-message is-error"}>{messageOk ? <Check size={15} /> : <X size={15} />} {message}</p>}
                </form>
              </section>
              <section className="admin-panel">
                <div className="admin-panel-head">
                  <div>
                    <span className="eyebrow">Canlı katalog</span>
                    <h2>Ürünler</h2>
                  </div>
                  <span className="admin-muted">{products.data?.length ?? 0} toplam</span>
                </div>
                <div className="admin-product-list">
                  {products.isLoading ? <p className="admin-muted">Ürünler yükleniyor...</p> : (products.data ?? []).map((product) => (
                    <div className={`admin-product-row ${product.isAvailable ? "" : "archived"}`} key={product.id}>
                      <img src={product.imageUrl || "/photos/collection.jpg"} alt="" />
                      <div className="admin-product-info">
                        <strong>{product.name}</strong>
                        <span>{product.category} · {(product.priceCents / 100).toLocaleString("tr-TR")} ₺</span>
                        <small>{product.isAvailable ? "Satışta" : "Arşivde"}</small>
                      </div>
                      <div className="admin-row-actions">
                        <button type="button" onClick={() => { setEditingId(product.id); setForm(toForm(product)); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="Düzenle"><Pencil size={15} /></button>
                        <button type="button" onClick={() => removeProduct(product.id)} aria-label="Sil"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <section className="admin-panel admin-orders">
              <div className="admin-panel-head">
                <div>
                  <span className="eyebrow">Sipariş akışı</span>
                  <h2>Son siparişler</h2>
                </div>
                <span className="admin-muted">Canlı · iyzico</span>
              </div>
              {(orders.data ?? []).length === 0 ? (
                <p className="admin-muted">Henüz sipariş yok. Ödeme başladığında burada görünecek.</p>
              ) : (
                <div className="admin-order-list">
                  {orders.data?.map((order) => (
                    <div className="admin-order-row" key={order.id}>
                      <div className="admin-order-top">
                        <strong>{order.orderNumber}</strong>
                        <em>{orderStatusLabel[order.status] ?? order.status}</em>
                      </div>
                      <span className="admin-order-who">{order.customerName} · {order.customerPhone || "telefon yok"}</span>
                      {order.shippingAddress ? <span className="admin-order-address">{order.shippingAddress}</span> : null}
                      {order.items?.length ? <span className="admin-order-items">{order.items.map((item) => item.productName).join(", ")}</span> : null}
                      <b>{(order.totalCents / 100).toLocaleString("tr-TR")} ₺</b>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <div className="admin-exit">
              <button className="admin-logout" type="button" disabled={loggingOut} onClick={exitAdmin}>
                <LogOut size={18} /> {loggingOut ? "Çıkılıyor..." : "Çıkış yap"}
              </button>
            </div>
          </div>
        </section>
      </PageRise>
    </>
  );
}

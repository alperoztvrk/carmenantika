import { Check, ImagePlus, LogIn, PackagePlus, Pencil, Save, ShieldAlert, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { StoreLayout } from "@/components/StoreLayout";
import { trpc } from "@/lib/trpc";

function AdminLogin() {
  const utils = trpc.useUtils();
  const status = trpc.auth.localStatus.useQuery();
  const login = trpc.auth.localLogin.useMutation({ onSuccess: () => utils.auth.me.invalidate() });
  const [password, setPassword] = useState("");
  const oauthReady = Boolean(import.meta.env.VITE_OAUTH_PORTAL_URL && import.meta.env.VITE_APP_ID);

  return (
    <StoreLayout>
      <section className="admin-login">
        <div className="admin-login-card">
          <LogIn size={22} />
          <span className="eyebrow">Carmen Antika / Yönetim</span>
          <h1>Giriş yap.</h1>
          <p>Ürün eklemek ve siparişleri görmek için yönetim şifrenle gir.</p>
          {status.data?.enabled && (
            <form onSubmit={(event) => { event.preventDefault(); login.mutate({ password }); }}>
              <label>
                Şifre
                <input type="password" value={password} autoFocus onChange={(event) => setPassword(event.target.value)} placeholder="Yönetim şifresi" />
              </label>
              <button className="admin-submit" type="submit" disabled={login.isPending}>{login.isPending ? "Giriliyor..." : "Giriş yap"}</button>
              {status.data.passwordHint && <small>Bu bilgisayarda şifre: <strong>{status.data.passwordHint}</strong></small>}
              {login.error && <p className="admin-message">{login.error.message}</p>}
            </form>
          )}
          {oauthReady && <button className="outline-cta" type="button" onClick={() => startLogin()}>Carmen hesabıyla giriş</button>}
        </div>
      </section>
    </StoreLayout>
  );
}

const emptyForm = { name: "", category: "Objeler", era: "", price: "", shortDescription: "", description: "", condition: "", dimensions: "", imageUrl: "", imageKey: "", tag: "", isAvailable: true, isFeatured: false };
type ProductForm = typeof emptyForm;

function priceToCents(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  return Math.round(Number(normalized) * 100);
}

function toForm(product: any): ProductForm {
  return { name: product.name, category: product.category, era: product.era, price: String(product.priceCents / 100), shortDescription: product.shortDescription, description: product.description, condition: product.condition, dimensions: product.dimensions ?? "", imageUrl: product.imageUrl, imageKey: product.imageKey ?? "", tag: product.tag ?? "", isAvailable: Boolean(product.isAvailable), isFeatured: Boolean(product.isFeatured) };
}

export default function Admin() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const products = trpc.product.adminList.useQuery(undefined, { enabled: isAdmin });
  const orders = trpc.order.adminList.useQuery(undefined, { enabled: isAdmin });
  const create = trpc.product.adminCreate.useMutation({ onSuccess: () => { products.refetch(); reset(); } });
  const update = trpc.product.adminUpdate.useMutation({ onSuccess: () => { products.refetch(); reset(); } });
  const archive = trpc.product.adminArchive.useMutation({ onSuccess: () => products.refetch() });
  const upload = trpc.product.adminUploadImage.useMutation();
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  function reset() { setForm(emptyForm); setEditingId(null); setMessage("Ürün kaydedildi."); }
  function setField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function handleFile(file?: File) {
    if (!file) return;
    setUploading(true); setMessage("");
    let dataUrl = "";
    try {
      dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const result = await upload.mutateAsync({ fileName: file.name.replace(/[^a-zA-Z0-9._-]/g, "-"), contentType: file.type, dataBase64: dataUrl.split(",")[1] ?? "" });
      setForm((current) => ({ ...current, imageUrl: result.url, imageKey: result.key })); setMessage("Görsel yüklendi.");
    } catch {
      if (dataUrl) { setForm((current) => ({ ...current, imageUrl: dataUrl, imageKey: "" })); setMessage("Görsel bu oturumda yerelde tutuluyor."); }
      else setMessage("Görsel yüklenemedi.");
    } finally { setUploading(false); }
  }
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const payload = { name: form.name, category: form.category, era: form.era, priceCents: priceToCents(form.price), shortDescription: form.shortDescription, description: form.description, condition: form.condition, dimensions: form.dimensions || undefined, imageUrl: form.imageUrl, imageKey: form.imageKey || undefined, tag: form.tag || undefined, isAvailable: form.isAvailable ? 1 : 0, isFeatured: form.isFeatured ? 1 : 0 };
    if (!payload.name || !payload.era || !payload.priceCents || !payload.imageUrl) { setMessage("İsim, dönem, fiyat ve görsel zorunlu."); return; }
    if (editingId) update.mutate({ id: editingId, data: payload }); else create.mutate(payload);
  }
  const availableCount = useMemo(() => (products.data ?? []).filter((product) => product.isAvailable).length, [products.data]);

  if (loading) return <StoreLayout><div className="admin-state">Yönetim alanı açılıyor...</div></StoreLayout>;
  if (!user) return <AdminLogin />;
  if (!isAdmin) return <StoreLayout><div className="admin-state"><ShieldAlert size={24} /><h1>Bu alan yalnızca admin içindir.</h1><p>Hesabının ürün yönetimi yetkisi bulunmuyor.</p></div></StoreLayout>;

  return <StoreLayout><section className="admin-page"><div className="container-carmen"><div className="admin-heading"><div><span className="eyebrow">Carmen Antika / Yönetim</span><h1>Parçalarını <em>yönet.</em></h1><p>Canlı koleksiyona ürün ekle, görsellerini yükle ve satılan parçaları arşivle.</p></div><div className="admin-stat"><strong>{availableCount}</strong><span>aktif parça</span></div></div><div className="admin-layout"><section className="admin-panel admin-form-panel"><div className="admin-panel-head"><div><span className="eyebrow">Ürün editörü</span><h2>{editingId ? "Parçayı düzenle" : "Yeni parça ekle"}</h2></div>{editingId && <button className="admin-quiet" type="button" onClick={reset}><X size={15} /> İptal</button>}</div><form className="admin-form" onSubmit={handleSubmit}><label>Ürün adı<input value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="Örn. National Cep Radyosu" /></label><div className="form-two"><label>Kategori<select value={form.category} onChange={(event) => setField("category", event.target.value)}><option>Objeler</option><option>Elektronik</option><option>Oyuncak & Oyun</option><option>Kitap & Plak</option><option>Ev & Sofra</option></select></label><label>Dönem / bilgi<input value={form.era} onChange={(event) => setField("era", event.target.value)} placeholder="1970'ler · çalışır" /></label></div><div className="form-two"><label>Fiyat (₺)<input inputMode="decimal" value={form.price} onChange={(event) => setField("price", event.target.value)} placeholder="1250" /></label><label>Etiket (opsiyonel)<input value={form.tag} onChange={(event) => setField("tag", event.target.value)} placeholder="Bugün bulundu" /></label></div><label>Kısa tanım<input value={form.shortDescription} onChange={(event) => setField("shortDescription", event.target.value)} placeholder="Kartta görünecek kısa cümle" /></label><label>Hikâyesi / açıklaması<textarea rows={4} value={form.description} onChange={(event) => setField("description", event.target.value)} placeholder="Bu parçayı nerede buldun, neden özel?" /></label><label>Kondisyon notu<textarea rows={3} value={form.condition} onChange={(event) => setField("condition", event.target.value)} placeholder="Çalışır durumda, yaşına bağlı izler..." /></label><div className="form-two"><label>Ölçüler<input value={form.dimensions} onChange={(event) => setField("dimensions", event.target.value)} placeholder="18 × 10 × 5 cm" /></label><label>Görsel yükle<input type="file" accept="image/*" onChange={(event) => handleFile(event.target.files?.[0])} /></label></div><div className="upload-box">{form.imageUrl ? <img src={form.imageUrl} alt="Ürün önizleme" /> : <ImagePlus size={22} />}{form.imageUrl ? <span>Görsel hazır</span> : <span>Yüklenen görsel burada görünür</span>}<small>{uploading ? "Yükleniyor..." : "8 MB altında JPG, PNG veya WebP"}</small></div><div className="form-checks"><label><input type="checkbox" checked={form.isAvailable} onChange={(event) => setField("isAvailable", event.target.checked)} /> Satışta</label><label><input type="checkbox" checked={form.isFeatured} onChange={(event) => setField("isFeatured", event.target.checked)} /> Öne çıkar</label></div><button className="admin-submit" disabled={create.isPending || update.isPending || uploading} type="submit">{editingId ? <><Save size={16} /> Güncelle</> : <><PackagePlus size={16} /> Ürünü yayınla</>}</button>{message && <p className="admin-message"><Check size={15} /> {message}</p>}</form></section><section className="admin-panel"><div className="admin-panel-head"><div><span className="eyebrow">Canlı katalog</span><h2>Ürünler</h2></div><span className="admin-muted">{products.data?.length ?? 0} toplam</span></div><div className="admin-product-list">{products.isLoading ? <p className="admin-muted">Ürünler yükleniyor...</p> : (products.data ?? []).map((product) => <div className={`admin-product-row ${product.isAvailable ? "" : "archived"}`} key={product.id}><img src={product.imageUrl} alt="" /><div className="admin-product-info"><strong>{product.name}</strong><span>{product.category} · {(product.priceCents / 100).toLocaleString("tr-TR")} ₺</span><small>{product.isAvailable ? "Satışta" : "Arşivde"}</small></div><div className="admin-row-actions"><button type="button" onClick={() => { setEditingId(product.id); setForm(toForm(product)); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="Düzenle"><Pencil size={15} /></button>{product.isAvailable && <button type="button" onClick={() => archive.mutate({ id: product.id })} aria-label="Arşivle"><Trash2 size={15} /></button>}</div></div>)}</div></section></div><section className="admin-panel admin-orders"><div className="admin-panel-head"><div><span className="eyebrow">Sipariş akışı</span><h2>Son siparişler</h2></div><span className="admin-muted">Stripe Checkout</span></div>{(orders.data ?? []).length === 0 ? <p className="admin-muted">Henüz sipariş yok. Ödeme tamamlandığında burada görünecek.</p> : <div className="admin-order-list">{orders.data?.map((order) => <div className="admin-order-row" key={order.id}><strong>{order.orderNumber}</strong><span>{order.customerName} · {order.customerEmail}</span><b>{(order.totalCents / 100).toLocaleString("tr-TR")} ₺</b><em>{order.status}</em></div>)}</div>}</section></div></section></StoreLayout>;
}

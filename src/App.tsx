import { ProductPhoto } from './components/ProductPhoto';
import { storageErrorMessage } from "./ui/storage-error";
import {
  ArrowLeft,
  ChevronRight,
  Circle,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Star,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Catalog, Product, Identifier } from "./domain/models";
import { prioritizedIdentifiers, statusLabels } from "./domain/models";
import { searchProducts } from "./domain/search";
import { repository, type CatalogRepository } from "./data/repository";
import { IdentifierCard } from "./components/IdentifierCard";
import { ProductForm } from "./components/ProductForm";
import {
  IdentifierForm,
  type IdentifierAction,
} from "./components/IdentifierForm";
const Settings = lazy(() =>
  import("./components/Settings").then((module) => ({
    default: module.Settings,
  })),
);
import { CodeType } from "./components/CodeType";
import { plainMessage } from "./ui/words";
import { PwaStatus } from "./components/PwaStatus";
import { ClassificationBrowser } from "./components/ClassificationBrowser";
import { CategoryManager } from "./components/CategoryManager";
import { categoryPath, UNCATEGORIZED } from "./domain/classification";
import { History } from "./components/History";
import { identifierConflicts, reviewReasons } from "./domain/maintenance";
import "./styles.css";
type Tab = "Search" | "Saved" | "Review" | "Settings" | "Departments";
type Editor =
  | { kind: "product"; product?: Product }
  | {
      kind: "identifier";
      action: IdentifierAction;
      product: Product;
      identifier?: Identifier;
    };
const emptyCatalog: Catalog = {
  categories: [],
  products: [],
  identifiers: [],
  sources: [],
  saved: [],
};
export default function App({
  store = repository,
}: {
  store?: CatalogRepository;
}) {
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("Search");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Product>();
  const [editor, setEditor] = useState<Editor>();
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const backButton = useRef<HTMLButtonElement>(null);
  const lastOpened = useRef<HTMLButtonElement | null>(null);
  async function reload() {
    setCatalog(await store.load());
  }
  useEffect(() => {
    let active = true;
    const receive = (data: Catalog) => {
      if (!active) return;
      setCatalog(data);
      setLoading(false);
      setSelected((previous) =>
        previous
          ? data.products.find((product) => product.id === previous.id)
          : undefined,
      );
    };
    const fail = (cause?: unknown) => {
      if (active) {
        setError(storageErrorMessage(cause));
        setLoading(false);
      }
    };
    const stop = store.watch?.(receive, fail);
    if (!stop) store.load().then(receive).catch(fail);
    return () => {
      active = false;
      stop?.();
    };
  }, [store]);
  useEffect(() => {
    if (selected && !editor) backButton.current?.focus();
  }, [selected?.id, editor]);

  useEffect(() => {
    if (
      category &&
      category !== UNCATEGORIZED &&
      !loading &&
      !catalog.categories.some((node) => node.id === category)
    )
      setCategory("");
  }, [category, catalog.categories, loading]);
  const reviewProducts = catalog.products.filter(
    (product) =>
      !product.archivedAt &&
      reviewReasons(
        product,
        catalog.identifiers.filter(
          (identifier) => identifier.productId === product.id,
        ),
        catalog.identifiers,
      ).length > 0,
  );
  const savedIds = new Set(
    catalog.saved.filter((item) => item.savedAt).map((item) => item.productId),
  );
  const browsableProducts =
    tab === "Review"
      ? reviewProducts
      : tab === "Saved"
        ? catalog.products.filter((p) => savedIds.has(p.id))
        : catalog.products;
  const products = searchProducts(
    browsableProducts,
    catalog.identifiers,
    query,
    category,
    catalog.categories,
  );
  async function open(product: Product, button: HTMLButtonElement) {
    lastOpened.current = button;
    setSelected(product);
    setShowHistory(false);
    setError("");
    try {
      await store.recordUse(product.id);
      await reload();
    } catch {
      setError(
        "Could not save recent activity. Your product details remain available.",
      );
    }
  }
  async function toggleSave() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await store.setSaved(selected.id, !savedIds.has(selected.id));
      await reload();
    } catch {
      setError("Could not save this change. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  async function refreshDetails(productId: string) {
    const updated = await store.load();
    setCatalog(updated);
    setSelected(updated.products.find((product) => product.id === productId));
    setEditor(undefined);
    setShowHistory(false);
    setTab((previous) => (previous === "Settings" ? "Search" : previous));
  }
  async function afterImport(productId?: string) {
    if (productId) {
      await refreshDetails(productId);
      setTab("Search");
    } else await reload();
  }
  function closeDetails() {
    setEditor(undefined);
    setSelected(undefined);
    requestAnimationFrame(() => lastOpened.current?.focus());
  }
  function renderCard(product: Product) {
    const identifiers = prioritizedIdentifiers(
      catalog.identifiers.filter((i) => i.productId === product.id),
    );
    return (
      <button
        key={product.id}
        className="product-card"
        onClick={(event) => {
          void open(product, event.currentTarget);
        }}
      >
        <ProductPhoto product={product} />
        <span className="card-copy">
          <span className="brand">{product.brand ?? "Brand not recorded"}</span>
          <strong>{product.name}</strong>
          <span className="badges">
            <span className="badge">
              {identifiers[0]
                ? statusLabels[identifiers[0].verificationStatus]
                : "No code in use"}
            </span>
            {savedIds.has(product.id) && <span className="badge">Saved</span>}
          </span>
        </span>
        <ChevronRight className="chevron" size={24} aria-hidden="true" />
      </button>
    );
  }
  return (
    <div className="app-shell">
      <header>
        <a
          className="wordmark"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            closeDetails();
            setTab("Search");
          }}
        >
          Cashier<span> Assistant</span>
        </a>
        <span className="local-label">
          <Circle size={8} fill="currentColor" aria-hidden="true" /> Saved on
          this device
        </span>
      </header>
      <PwaStatus />
      <main>
        {tab === "Settings" && !selected && !editor && (
          <div className="secondary-actions">
            <button
              onClick={() => {
                setEditor({ kind: "product" });
                setShowHistory(false);
              }}
            >
              Add product
            </button>
            <button
              onClick={() => {
                setEditor(undefined);
                setSelected(undefined);
                setTab("Review");
                setQuery("");
                setCategory("");
              }}
            >
              Needs checking ({reviewProducts.length})
            </button>
            <button onClick={() => setTab("Departments")}>
              Manage departments
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Opening your saved products…</p>
        ) : tab === "Departments" ? (
          <CategoryManager
            catalog={catalog}
            store={store}
            onDone={() => setTab("Settings")}
          />
        ) : tab === "Settings" && !editor ? (
          <Suspense fallback={<p role="status">Opening backup tools…</p>}>
            <Settings
              store={store}
              catalog={catalog}
              onImported={afterImport}
            />
          </Suspense>
        ) : editor?.kind === "product" ? (
          <ProductForm
            key={editor.product?.id ?? "new-product"}
            product={editor.product}
            products={catalog.products}
            categories={catalog.categories}
            onCancel={() => setEditor(undefined)}
            onSave={async (input, reason) => {
              const product = editor.product
                ? await store.updateProduct(
                    editor.product.id,
                    input,
                    reason,
                    editor.product.updatedAt,
                  )
                : await store.createProduct(input, reason);
              await refreshDetails(product.id);
            }}
          />
        ) : editor?.kind === "identifier" ? (
          <IdentifierForm
            key={`${editor.action}:${editor.identifier?.id ?? "new"}`}
            action={editor.action}
            identifier={editor.identifier}
            product={editor.product}
            products={catalog.products}
            identifiers={catalog.identifiers}
            onCancel={() => setEditor(undefined)}
            onSave={async (input, verification) => {
              if (editor.action === "add")
                await store.addIdentifier(editor.product.id, input);
              else if (editor.identifier && editor.action === "correct")
                await store.correctIdentifier(
                  editor.identifier.id,
                  input,
                  editor.identifier.updatedAt,
                );
              else if (editor.identifier && editor.action === "verify")
                await store.verifyIdentifier(
                  editor.identifier.id,
                  verification,
                  editor.identifier.updatedAt,
                );
              else if (editor.identifier)
                await store.retireIdentifier(
                  editor.identifier.id,
                  input.reason,
                  editor.identifier.updatedAt,
                );
              await refreshDetails(editor.product.id);
            }}
          />
        ) : selected ? (
          <>
            <button ref={backButton} className="back" onClick={closeDetails}>
              <ArrowLeft size={18} aria-hidden="true" />
              Back to {tab.toLowerCase()}
            </button>
            <section className="detail">
              <div className="detail-heading">
                <ProductPhoto product={selected} />
                <div>
                  <p className="eyebrow">
                    {selected.brand ?? "Brand not recorded"}
                  </p>
                  <h1>{selected.name}</h1>

                </div>
              </div>

              <h2>Product codes</h2>
              <p className="muted">
                A similar-looking package is not enough. Check the brand and code.
              </p>
              {prioritizedIdentifiers(
                catalog.identifiers.filter((i) => i.productId === selected.id),
              ).map((identifier) => (
                <div
                  className="identifier-group"
                  key={`${identifier.id}:${identifier.updatedAt}`}
                >
                  <IdentifierCard
                    identifier={identifier}
                    source={catalog.sources.find(
                      (source) => source.id === identifier.sourceId,
                    )}
                    isDemo={selected.isDemo === true}
                    hasConflict={
                      identifierConflicts(identifier, catalog.identifiers)
                        .length > 0
                    }
                  >
                    <div className="actions identifier-actions">
                      <button
                        aria-label={`Incorrect code for ${identifier.code}`}
                        onClick={() =>
                          setEditor({
                            kind: "identifier",
                            action: "correct",
                            identifier,
                            product: selected,
                          })
                        }
                      >
                        Incorrect code
                      </button>
                      <button
                        aria-label={`Check code for ${identifier.code}`}
                        onClick={() =>
                          setEditor({
                            kind: "identifier",
                            action: "verify",
                            identifier,
                            product: selected,
                          })
                        }
                      >
                        Check code
                      </button>
                      <button
                        aria-label={`Stop using ${identifier.code}`}
                        onClick={() =>
                          setEditor({
                            kind: "identifier",
                            action: "retire",
                            identifier,
                            product: selected,
                          })
                        }
                      >
                        Stop using
                      </button>
                    </div>
                  </IdentifierCard>
                </div>
              ))}
              {!catalog.identifiers.some(
                (i) => i.productId === selected.id && i.isActive,
              ) && <p>No codes are currently in use.</p>}
              <div className="actions">
                <button
                  onClick={() =>
                    setEditor({
                      kind: "identifier",
                      action: "add",
                      product: selected,
                    })
                  }
                >
                  Add code
                </button>
                <button
                  onClick={() =>
                    setEditor({ kind: "product", product: selected })
                  }
                >
                  Edit product
                </button>
                <button
                  aria-expanded={showHistory}
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory ? "Hide history" : "View history"}
                </button>
              </div>
              {catalog.identifiers.some(
                (identifier) =>
                  identifier.productId === selected.id && !identifier.isActive,
              ) && (
                <details className="retired">
                  <summary>Codes no longer in use</summary>
                  {catalog.identifiers
                    .filter(
                      (identifier) =>
                        identifier.productId === selected.id &&
                        !identifier.isActive,
                    )
                    .map((identifier) => (
                      <p key={identifier.id}>
                        <CodeType type={identifier.type} /> · {identifier.code}{" "}
                        · No longer used (not checkout-ready)
                      </p>
                    ))}
                </details>
              )}
              {showHistory && (
                <History
                  productId={selected.id}
                  store={store}
                  sources={catalog.sources}
                />
              )}
              {selected.barcodePhotoDataUrl && <details className="barcode-reference"><summary>Barcode photo · reference only</summary><p className="muted">Use this photo to read and compare the printed number. It is not a verified checkout barcode.</p><img className="photo-preview" src={selected.barcodePhotoDataUrl} alt="Saved barcode reference photo" /></details>}
              <dl>
                <div>
                  <dt>Department</dt>
                  <dd>
                    {categoryPath(catalog.categories, selected.categoryId)[0]
                      ?.name || "No department"}
                  </dd>
                </div>
                <div>
                  <dt>Keywords</dt>
                  <dd>{selected.keywords.join(", ") || "Not recorded"}</dd>
                </div>
              </dl>
              <button
                className="primary"
                disabled={saving}
                aria-pressed={savedIds.has(selected.id)}
                onClick={() => {
                  void toggleSave();
                }}
              >
                {savedIds.has(selected.id)
                  ? "Remove from saved"
                  : "Save product"}
              </button>
            </section>
          </>
        ) : (
          <>
            <div className="page-heading">
              <h1>
                {tab === "Search"
                  ? "Search Products"
                  : tab === "Saved"
                    ? "Saved Products"
                    : "Products that need checking."}
              </h1>
            </div>
            <div className="search-controls">
              <div className="search-box">
                <SearchIcon size={22} aria-hidden="true" />
                <input
                  id="search"
                  aria-label="Search saved products"
                  type="search"
                  value={query}
                  placeholder="Name, brand, keyword or code"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
            {category && (
              <button className="clear-filters" onClick={() => setCategory("")}>
                Clear filters
              </button>
            )}
            <ClassificationBrowser
              categories={catalog.categories}
              products={browsableProducts}
              value={category}
              onChange={(id) => setCategory(id ?? "")}
            />
            <div className="results-heading">
              <h2>
                {tab === "Review"
                  ? "Needs review"
                  : tab === "Saved"
                    ? "Saved"
                    : query || category
                      ? "Matches"
                      : "All products"}
              </h2>
              <span role="status">
                {products.length}{" "}
                {products.length === 1 ? "product" : "products"}
              </span>
            </div>
            <div className="product-list">
              {products.map((product) =>
                tab === "Review" ? (
                  <div key={product.id}>
                    {renderCard(product)}
                    <p className="review-reasons">
                      {reviewReasons(
                        product,
                        catalog.identifiers.filter(
                          (identifier) => identifier.productId === product.id,
                        ),
                        catalog.identifiers,
                      )
                        .map(plainMessage)
                        .join(" · ")}
                    </p>
                  </div>
                ) : (
                  renderCard(product)
                ),
              )}
            </div>
            {products.length === 0 && (
              <div className="empty">
                <h2>
                  {tab === "Review" && !query && !category
                    ? "Nothing needs review"
                    : tab === "Saved" && !query && !category
                      ? "No saved products yet"
                      : "No matching products"}
                </h2>
                <p>
                  {tab === "Saved" && !query && !category
                    ? "Open a product and choose Save product to keep it here."
                    : "Try another name, keyword or code, or choose all departments."}
                </p>
              </div>
            )}
            {tab === "Search" &&
              !query &&
              !category &&
              catalog.saved.some((item) => item.useCount > 1) && (
                <section className="recent">
                  <h2>Frequently opened</h2>
                  <div className="product-list">
                    {catalog.saved
                      .filter((item) => item.useCount > 1)
                      .sort(
                        (a, b) =>
                          b.useCount - a.useCount ||
                          (b.lastUsedAt ?? "").localeCompare(
                            a.lastUsedAt ?? "",
                          ),
                      )
                      .slice(0, 3)
                      .map((item) =>
                        catalog.products.find(
                          (product) =>
                            product.id === item.productId &&
                            !product.archivedAt,
                        ),
                      )
                      .filter((product): product is Product => !!product)
                      .map(renderCard)}
                  </div>
                </section>
              )}
            {tab === "Search" &&
              !query &&
              !category &&
              catalog.saved.some((s) => s.lastUsedAt) && (
                <section className="recent">
                  <h2>Recently opened</h2>
                  <div className="product-list">
                    {catalog.saved
                      .filter((s) => s.lastUsedAt)
                      .sort((a, b) =>
                        b.lastUsedAt!.localeCompare(a.lastUsedAt!),
                      )
                      .slice(0, 3)
                      .map((s) =>
                        catalog.products.find(
                          (p) => p.id === s.productId && !p.archivedAt,
                        ),
                      )
                      .filter((p): p is Product => !!p)
                      .map(renderCard)}
                  </div>
                </section>
              )}
          </>
        )}
      </main>
      {!(editor?.kind === "product" && !editor.product) && <nav aria-label="Main navigation">
        {(["Search", "Saved", "Settings"] as Tab[]).map((value) => (
          <button
            key={value}
            aria-current={
              tab === value || (tab === "Departments" && value === "Settings")
                ? "page"
                : undefined
            }
            onClick={() => {
              setEditor(undefined);
              setSelected(undefined);
              setTab(value);
              setQuery("");
              setCategory("");
            }}
          >
            <span className="nav-icon" aria-hidden="true">
              {value === "Search" ? (
                <SearchIcon size={20} />
              ) : value === "Saved" ? (
                <Star size={20} />
              ) : (
                <SettingsIcon size={20} />
              )}
            </span>
            <span>{value}</span>
          </button>
        ))}
      </nav>}
      <footer>Personal product lookup</footer>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ShoppingCart,
  Sparkles,
  Laptop,
  Headphones,
  Keyboard,
  Mouse,
  ArrowRight,
  Wallet,
  X,
  Star,
  RefreshCw,
} from "lucide-react";
import "./App.css";

const API_URL = "http://127.0.0.1:8001";

const productIcons = [Laptop, Headphones, Keyboard, Mouse];

function getProductIcon(product) {
  const name = product.name.toLowerCase();

  if (name.includes("headphone") || name.includes("speaker")) {
    return Headphones;
  }

  if (name.includes("laptop") || name.includes("watch")) {
    return Laptop;
  }

  if (name.includes("shoe") || name.includes("shirt")) {
    return Keyboard;
  }

  return productIcons[product.id % productIcons.length] || Mouse;
}

function App() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [budget, setBudget] = useState(50000);
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assistantQuery, setAssistantQuery] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [assistantMessage, setAssistantMessage] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_URL}/products`);

        if (!response.ok) {
          throw new Error("Unable to load products from the backend.");
        }

        const data = await response.json();
        setProducts(data.products || []);
      } catch (err) {
        setError(
          "Cannot connect to the backend. Make sure FastAPI is running on port 8001."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  const categories = useMemo(
    () => ["All", ...new Set(products.map((product) => product.category))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();

    return products.filter((product) => {
      const searchableText =
        `${product.name} ${product.category} ${product.description}`.toLowerCase();

      const matchesSearch = searchableText.includes(searchTerm);
      const matchesBudget = product.price <= budget;
      const matchesCategory =
        category === "All" || product.category === category;

      return matchesSearch && matchesBudget && matchesCategory;
    });
  }, [products, query, budget, category]);

  const cartTotal = cart.reduce(
    (total, product) => total + product.price,
    0
  );

  function addToCart(product) {
    setCart((currentCart) => [...currentCart, product]);
  }

  function removeFromCart(index) {
    setCart((currentCart) =>
      currentCart.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  async function findRecommendations(event) {
    event.preventDefault();

    if (!assistantQuery.trim()) {
      setAssistantMessage("Tell me what you're looking for first.");
      return;
    }

    try {
      setAssistantLoading(true);
      setAssistantMessage("");

      const response = await fetch(
        `${API_URL}/recommendations?query=${encodeURIComponent(
          assistantQuery.trim()
        )}`
      );

      if (!response.ok) {
        throw new Error("Recommendation request failed.");
      }

      const data = await response.json();
      setRecommendations(data.recommendations || []);
      setAssistantMessage(data.message || "");
    } catch {
      setAssistantMessage(
        "Unable to get recommendations. Check that the backend is running."
      );
      setRecommendations([]);
    } finally {
      setAssistantLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="navbar">
        <a className="brand" href="#home">
          <span className="brand-icon">
            <Sparkles size={22} />
          </span>
          <span>SmartCart AI</span>
        </a>

        <nav>
          <a href="#home">Home</a>
          <a href="#products">Explore Products</a>
          <a href="#assistant">AI Assistant</a>
        </nav>

        <button
          className="cart-button"
          onClick={() =>
            document
              .getElementById("cart")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <ShoppingCart size={19} />
          Cart <span>{cart.length}</span>
        </button>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-content">
            <div className="badge">
              <Sparkles size={15} />
              YOUR PERSONAL AI SHOPPING ASSISTANT
            </div>

            <h1>
              Smarter Shopping.
              <br />
              <span>Powered by AI.</span>
            </h1>

            <p>
              Discover products that fit your needs and budget.
              Find your next favorite with personalized recommendations.
            </p>

            <a className="primary-button" href="#products">
              Explore Products <ArrowRight size={18} />
            </a>
          </div>

          <div className="hero-card">
            <div className="hero-card-icon">
              <Sparkles size={30} />
            </div>
            <p className="muted">YOUR SHOPPING COMPANION</p>
            <h2>Find what you need.</h2>
            <p>
              Describe your needs, set your budget, and explore
              products from our live backend API.
            </p>
            <div className="recommendation-tag">
              <span className="status-dot" />
              API-connected shopping
            </div>
          </div>
        </section>

        <section className="shopping-section" id="products">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DISCOVER</p>
              <h2>Find your perfect product</h2>
              <p>Explore our catalog and build your cart.</p>
            </div>
            <span className="product-count">
              {filteredProducts.length} products
            </span>
          </div>

          <div className="filters">
            <div className="search-box">
              <Search size={20} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products..."
                aria-label="Search products"
              />
            </div>

            <label className="budget-filter">
              <span>Maximum budget</span>
              <strong>₹{budget.toLocaleString("en-IN")}</strong>
              <input
                type="range"
                min="500"
                max="50000"
                step="500"
                value={budget}
                onChange={(event) => setBudget(Number(event.target.value))}
                aria-label="Maximum budget"
              />
            </label>
          </div>

          <div className="category-filters">
            {categories.map((item) => (
              <button
                key={item}
                className={`category-button ${
                  category === item ? "active" : ""
                }`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="empty-state">
              <RefreshCw size={30} />
              <h3>Loading products...</h3>
              <p>Connecting to your FastAPI backend.</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <h3>Backend connection issue</h3>
              <p>{error}</p>
              <button
                className="add-button"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map((product) => {
                const Icon = getProductIcon(product);

                return (
                  <article className="product-card" key={product.id}>
                    <div className="product-visual">
                      {product.emoji ? (
                        <span className="product-emoji" role="img" aria-label={product.name}>
                          {product.emoji}
                        </span>
                      ) : (
                        <Icon size={54} strokeWidth={1.4} />
                      )}
                      <span className="product-label">
                        {product.category}
                      </span>
                    </div>

                    <div className="product-info">
                      <h3>{product.name}</h3>
                      <p>{product.description}</p>

                      <div className="product-rating">
                        <Star size={15} fill="currentColor" />
                        <span>{product.rating ?? "New"}</span>
                      </div>

                      <div className="product-footer">
                        <strong>
                          ₹{product.price.toLocaleString("en-IN")}
                        </strong>
                        <button
                          className="add-button"
                          onClick={() => addToCart(product)}
                        >
                          Add +
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && !error && filteredProducts.length === 0 && (
            <div className="empty-state">
              <Search size={32} />
              <h3>No matching products</h3>
              <p>Try another search, category, or budget.</p>
            </div>
          )}
        </section>

        <section className="assistant-section" id="assistant">
          <div className="assistant-icon">
            <Sparkles size={27} />
          </div>

          <div className="assistant-content">
            <p className="eyebrow">SHOPPING ASSISTANT</p>
            <h2>What are you looking for?</h2>
            <p>
              Describe a product or category to find matching items
              from the recommendation API.
            </p>

            <form className="assistant-form" onSubmit={findRecommendations}>
              <input
                value={assistantQuery}
                onChange={(event) => setAssistantQuery(event.target.value)}
                placeholder="Try electronics, headphones, or fashion..."
                aria-label="Describe what you want"
                maxLength={100}
              />
              <button
                className="checkout-button"
                type="submit"
                disabled={assistantLoading}
              >
                <Sparkles size={18} />
                {assistantLoading ? "Finding..." : "Find Products"}
              </button>
            </form>

            {assistantMessage && (
              <p className="assistant-message" role="status">
                {assistantMessage}
              </p>
            )}

            {recommendations.length > 0 && (
              <div className="recommendation-results">
                {recommendations.map((product) => (
                  <div className="recommendation-item" key={product.id}>
                    <div>
                      <strong>{product.name}</strong>
                      <p>
                        ₹{product.price.toLocaleString("en-IN")} ·{" "}
                        {product.category}
                      </p>
                    </div>
                    <button
                      className="add-button"
                      onClick={() => addToCart(product)}
                    >
                      Add +
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="checkout-note">
              Current recommendations use keyword matching, not a trained AI
              model.
            </p>
          </div>
        </section>

        <section className="cart-section" id="cart">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR SELECTION</p>
              <h2>Shopping cart</h2>
            </div>
            <ShoppingCart size={25} />
          </div>

          {cart.length === 0 ? (
            <div className="empty-state">
              <ShoppingCart size={32} />
              <h3>Your cart is empty</h3>
              <p>Add products to see your order summary.</p>
            </div>
          ) : (
            <div className="cart-content">
              {cart.map((product, index) => (
                <div className="cart-item" key={`${product.id}-${index}`}>
                  <div>
                    <h3>{product.name}</h3>
                    <p>₹{product.price.toLocaleString("en-IN")}</p>
                  </div>

                  <button
                    className="remove-button"
                    onClick={() => removeFromCart(index)}
                    aria-label={`Remove ${product.name}`}
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}

              <div className="cart-total">
                <span>Total</span>
                <strong>₹{cartTotal.toLocaleString("en-IN")}</strong>
              </div>

              <button
                className="checkout-button"
                onClick={() =>
                  alert(
                    "Checkout is not connected yet. We'll integrate PayPal Sandbox next."
                  )
                }
              >
                <Wallet size={19} />
                Continue to Checkout
              </button>

              <p className="checkout-note">
                Demo cart only. No payment will be processed.
              </p>
            </div>
          )}
        </section>
      </main>

      <footer>
        <p>
          <Sparkles size={16} /> SmartCart AI
        </p>
        <span>AI-powered shopping experience</span>
      </footer>
    </div>
  );
}

export default App;
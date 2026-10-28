import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { addToCart } from '../redux/cartSlice';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cartMessage, setCartMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const dispatch = useDispatch();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    fetch('https://fakestoreapi.com/products', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Product request failed (${response.status}).`);
        }
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error('The product service returned an unexpected response.');
        }
        setProducts(data);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message || 'Products could not be loaded. Please try again.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (!cartMessage) return undefined;
    const timer = setTimeout(() => setCartMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [cartMessage]);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category))],
    [products]
  );

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = products.filter((product) => {
      const matchesCategory = category === 'all' || product.category === category;
      const matchesSearch = !query || product.title.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });

    if (sort === 'price-low') result.sort((a, b) => a.price - b.price);
    if (sort === 'price-high') result.sort((a, b) => b.price - a.price);
    if (sort === 'name') result.sort((a, b) => a.title.localeCompare(b.title));
    return result;
  }, [category, products, search, sort]);

  const handleAddToCart = (product) => {
    dispatch(addToCart(product));
    setCartMessage(`${product.title} added to your cart.`);
  };

  if (selectedProduct) {
    return (
      <main className="container shop-container">
        <button className="btn btn-link back-link px-0 mb-4" onClick={() => setSelectedProduct(null)}>
          <i className="bi bi-arrow-left me-2" aria-hidden="true" />
          Back to products
        </button>
        <article className="product-detail card border-0 shadow-sm">
          <div className="row g-0 align-items-center">
            <div className="col-md-5 product-detail-image">
              <img src={selectedProduct.image} alt={selectedProduct.title} />
            </div>
            <div className="col-md-7">
              <div className="card-body p-4 p-lg-5">
                <span className="eyebrow">{selectedProduct.category}</span>
                <h1 className="h2 mt-2">{selectedProduct.title}</h1>
                <p className="text-secondary mt-3">{selectedProduct.description}</p>
                <p className="product-price detail-price">{currency.format(selectedProduct.price)}</p>
                <button className="btn btn-brand btn-lg" onClick={() => handleAddToCart(selectedProduct)}>
                  <i className="bi bi-bag-plus me-2" aria-hidden="true" />
                  Add to cart
                </button>
                {cartMessage && <p className="alert alert-success mt-3 mb-0" role="status">{cartMessage}</p>}
              </div>
            </div>
          </div>
        </article>
      </main>
    );
  }

  return (
    <main>
      <section
        className="shop-hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgb(20 43 34 / 88%) 0%, rgb(20 43 34 / 66%) 47%, rgb(20 43 34 / 12%) 100%), url("${process.env.PUBLIC_URL}/Image1.jpg")`
        }}
      >
        <div className="container shop-hero-content">
          <p className="eyebrow text-white-50">A little something for everyone</p>
          <h1>Find your next<br />everyday favorite.</h1>
          <p>Thoughtful picks, easy browsing, and a cart that stays with you.</p>
          <a className="btn btn-light btn-lg mt-2" href="#products">Explore products</a>
        </div>
      </section>

      <section className="container shop-container" id="products">
        <div className="section-heading">
          <div>
            <p className="eyebrow mb-2">The collection</p>
            <h2>Shop all products</h2>
          </div>
          {!loading && !error && <span className="text-secondary">{visibleProducts.length} items</span>}
        </div>

        {cartMessage && <div className="alert alert-success" role="status">{cartMessage}</div>}

        <div className="catalog-controls">
          <div className="category-list" aria-label="Filter products by category">
            <button
              type="button"
              className={`category-chip ${category === 'all' ? 'active' : ''}`}
              aria-pressed={category === 'all'}
              onClick={() => setCategory('all')}
            >
              All
            </button>
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                className={`category-chip ${category === item ? 'active' : ''}`}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="catalog-tools">
            <label className="visually-hidden" htmlFor="product-search">Search products</label>
            <div className="search-control">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                id="product-search"
                type="search"
                className="form-control"
                placeholder="Search products"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <label className="visually-hidden" htmlFor="product-sort">Sort products</label>
            <select id="product-sort" className="form-select sort-control" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="featured">Featured</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="name">Name: A to Z</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="loading-state" role="status">
            <span className="spinner-border text-dark" aria-hidden="true" />
            <span>Finding good things for you...</span>
          </div>
        )}

        {error && (
          <div className="empty-state" role="alert">
            <i className="bi bi-cloud-slash" aria-hidden="true" />
            <h3>We couldn’t load the products</h3>
            <p>{error}</p>
            <button className="btn btn-brand" onClick={() => setReloadKey((key) => key + 1)}>Try again</button>
          </div>
        )}

        {!loading && !error && visibleProducts.length === 0 && (
          <div className="empty-state">
            <i className="bi bi-search" aria-hidden="true" />
            <h3>No matching products</h3>
            <p>Try a different search or category.</p>
            <button
              className="btn btn-outline-dark"
              onClick={() => {
                setSearch('');
                setCategory('all');
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        {!loading && !error && visibleProducts.length > 0 && (
          <div className="product-grid">
            {visibleProducts.map((product) => (
              <article className="product-card card" key={product.id}>
                <button
                  type="button"
                  className="product-image-button"
                  onClick={() => setSelectedProduct(product)}
                  aria-label={`View ${product.title}`}
                >
                  <img src={product.image} alt="" loading="lazy" />
                </button>
                <div className="product-card-body">
                  <span className="eyebrow">{product.category}</span>
                  <h3>{product.title}</h3>
                  <div className="product-card-footer">
                    <span className="product-price">{currency.format(product.price)}</span>
                    <button
                      type="button"
                      className="add-button"
                      onClick={() => handleAddToCart(product)}
                      aria-label={`Add ${product.title} to cart`}
                    >
                      <i className="bi bi-plus-lg" aria-hidden="true" />
                    </button>
                  </div>
                  <button type="button" className="view-product-link" onClick={() => setSelectedProduct(product)}>
                    View details <i className="bi bi-arrow-up-right" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Home;

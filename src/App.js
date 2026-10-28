import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Navbar from './Components/Navbar';
import Cart from './Components/Cart';
import Home from './Components/Home';
import About from './Components/About';
import Contact from './Components/Contact';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={
          <main className="container shop-container empty-state">
            <i className="bi bi-compass" aria-hidden="true" />
            <h1>We can’t find that page</h1>
            <p>The page may have moved, or the address may be incorrect.</p>
            <Link className="btn btn-brand" to="/">Back to shopping</Link>
          </main>
        } />
      </Routes>
      <footer className="shop-footer">
        <div className="container">
          <span>ShopFusion</span>
          <span>Curated finds for everyday living.</span>
        </div>
      </footer>
    </Router>
  );
}

export default App;

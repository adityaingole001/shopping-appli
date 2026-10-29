import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Navbar from './Components/Navbar';
import Cart from './Components/Cart';
import Home from './Components/Home';
import About from './Components/About';
import Contact from './Components/Contact';
import Profile from './Components/Profile';

function App() {
  return (
    <Router>
      <Navbar />
      <AnimatedRoutes />
      <footer className="shop-footer">
        <div className="container">
          <span>ShopFusion</span>
          <span>Curated finds for everyday living.</span>
        </div>
      </footer>
    </Router>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className="route-transition"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: 'easeOut' }}
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/profile" element={<Profile />} />
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
      </motion.div>
    </AnimatePresence>
  );
}

export default App;

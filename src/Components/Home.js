// import React, { useEffect, useState } from 'react';
// import { useDispatch } from 'react-redux';
// import { addToCart } from '../redux/cartSlice';

// function Home() {
//   const [products, setProducts] = useState([]);
//   const [filtered, setFiltered] = useState([]);
//   const [categories, setCategories] = useState([]);
//   const [selectedProduct, setSelectedProduct] = useState(null);
//   const dispatch = useDispatch();

//   useEffect(() => {
//     fetch('https://fakestoreapi.com/products')
//       .then(res => res.json())
//       .then(data => {
//         setProducts(data);
//         setFiltered(data);
//         setCategories([...new Set(data.map(item => item.category))]);
//       });
//   }, []);

//   const handleFilter = (category) => {
//     if (category === "all") {
//       setFiltered(products);
//     } else {
//       setFiltered(products.filter(item => item.category === category));
//     }
//   };

//   const handleAddToCart = (product) => {
//     dispatch(addToCart(product));
//     alert("Added to cart!");
//   };

//   if (selectedProduct) {
//     return (
//       <div className="container mt-5">
//         <button className="btn btn-dark mb-3" onClick={() => setSelectedProduct(null)}>
//           ← Back to Products
//         </button>
//         <div className="card shadow p-3">
//           <div className="row">
//             <div className="col-md-4 text-center">
//               <img
//                 src={selectedProduct.image}
//                 alt={selectedProduct.title}
//                 className="img-fluid"
//                 style={{ height: '250px', objectFit: 'contain' }}
//               />
//             </div>
//             <div className="col-md-8">
//               <h3>{selectedProduct.title}</h3>
//               <p className="text-muted">{selectedProduct.category}</p>
//               <p>{selectedProduct.description}</p>
//               <h4>${selectedProduct.price}</h4>
//               <button className="btn btn-dark mt-2" onClick={() => handleAddToCart(selectedProduct)}>
//                 Add to Cart
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="container mt-4">
//       {/* Bootstrap Carousel */}
//       <div id="carouselExampleIndicators" className="carousel slide mb-4" data-bs-ride="carousel">
//         <div className="carousel-indicators">
//           <button type="button" data-bs-target="#carouselExampleIndicators" data-bs-slide-to="0" className="active"></button>
//           <button type="button" data-bs-target="#carouselExampleIndicators" data-bs-slide-to="1"></button>
//           <button type="button" data-bs-target="#carouselExampleIndicators" data-bs-slide-to="2"></button>
//         </div>
//         <div className="carousel-inner">
//           <div className="carousel-item active">
//             <img src="Image1.jpg" className="d-block w-100" alt="Slide 1" />
//           </div>
//           <div className="carousel-item">
//             <img src="Image2.jpg" className="d-block w-100" alt="Slide 2" />
//           </div>
//           <div className="carousel-item">
//             <img src="Image3.jpg" className="d-block w-100" alt="Slide 3" />
//           </div>
//         </div>
//         <button className="carousel-control-prev" type="button" data-bs-target="#carouselExampleIndicators" data-bs-slide="prev">
//           <span className="carousel-control-prev-icon" aria-hidden="true"></span>
//           <span className="visually-hidden">Previous</span>
//         </button>
//         <button className="carousel-control-next" type="button" data-bs-target="#carouselExampleIndicators" data-bs-slide="next">
//           <span className="carousel-control-next-icon" aria-hidden="true"></span>
//           <span className="visually-hidden">Next</span>
//         </button>
//       </div>

//       {/* Filters */}
//       <h2 className="text-center mb-3">Products</h2>
//       <div className="text-center mb-4">
//         <button className="btn btn-dark mx-2 mb-2" onClick={() => handleFilter("all")}>
//           All
//         </button>
//         {categories.map((cat, index) => (
//           <button
//             key={index}
//             className="btn btn-dark mx-2 mb-2"
//             onClick={() => handleFilter(cat)}
//           >
//             {cat}
//           </button>
//         ))}
//       </div>

//       {/* Product Grid */}
//       <div className="row">
//         {filtered.map(product => (
//           <div key={product.id} className="col-md-4 mb-4">
//             <div className="card h-100 shadow-sm">
//               <img
//                 src={product.image}
//                 alt={product.title}
//                 className="card-img-top p-3"
//                 style={{ height: '200px', objectFit: 'contain' }}
//               />
//               <div className="card-body d-flex flex-column">
//                 <h6 className="card-title text-center">{product.title.slice(0, 40)}...</h6>
//                 <p className="text-success text-center fw-bold">${product.price}</p>
//                 <button
//                   className="btn btn-dark mt-auto"
//                   onClick={() => setSelectedProduct(product)}
//                 >
//                   View Details
//                 </button>
//               </div>
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// export default Home;
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { addToCart } from '../redux/cartSlice';

function Home() {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cartMessage, setCartMessage] = useState('');
  const dispatch = useDispatch();

  useEffect(() => {
    fetch('https://fakestoreapi.com/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        setFiltered(data);
        setCategories([...new Set(data.map(item => item.category))]);
      });
  }, []);

  const handleFilter = (category) => {
    if (category === "all") {
      setFiltered(products);
    } else {
      setFiltered(products.filter(item => item.category === category));
    }
  };

  const handleAddToCart = (product) => {
    dispatch(addToCart(product));
    setCartMessage(`${product.title.slice(0, 20)} added to cart!`);

    // Clear message after 2 seconds
    setTimeout(() => setCartMessage(''), 2000);
  };

  if (selectedProduct) {
    return (
      <div className="container mt-5">
        <button className="btn btn-dark mb-3" onClick={() => setSelectedProduct(null)}>
          ← Back to Products
        </button>
        <div className="card shadow p-3">
          <div className="row">
            <div className="col-md-4 text-center">
              <img src={selectedProduct.image} alt={selectedProduct.title} className="img-fluid" style={{ height: '250px', objectFit: 'contain' }} />
            </div>
            <div className="col-md-8">
              <h3>{selectedProduct.title}</h3>
              <p className="text-muted">{selectedProduct.category}</p>
              <p>{selectedProduct.description}</p>
              <h4>${selectedProduct.price}</h4>

              {/* Message */}
              {cartMessage && <p className="text-success fw-bold">{cartMessage}</p>}

              <button className="btn btn-dark mt-2" onClick={() => handleAddToCart(selectedProduct)}>
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <img src="Image1.jpg" alt="" width="100%" />
      <h2 className="text-center mt-3 mb-3">Products</h2>

      {/* Message */}
      {cartMessage && <div className="text-success text-center fw-bold mb-3">{cartMessage}</div>}

      <div className="text-center mb-4">
        <button className="btn btn-dark mx-2 mb-2" onClick={() => handleFilter("all")}>
          All
        </button>
        {categories.map((cat, index) => (
          <button key={index} className="btn btn-dark mx-2 mb-2" onClick={() => handleFilter(cat)}>
            {cat}
          </button>
        ))}
      </div>

      <div className="row">
        {filtered.map(product => (
          <div key={product.id} className="col-md-4 mb-4">
            <div className="card h-100 shadow-sm">
              <img src={product.image} alt={product.title} className="card-img-top p-3" style={{ height: '200px', objectFit: 'contain' }} />
              <div className="card-body d-flex flex-column">
                <h6 className="card-title text-center">{product.title.slice(0, 40)}...</h6>
                <p className="text-success text-center fw-bold">${product.price}</p>
                <button className="btn btn-dark mt-auto" onClick={() => setSelectedProduct(product)}>
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Home;

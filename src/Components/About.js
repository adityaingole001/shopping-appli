function About() {
  return (
    <section id="About-img"
      className="position-relative text-white d-flex align-items-center"
      style={{ backgroundImage: `url("${process.env.PUBLIC_URL}/Image.jpg")` }}
    >
      <div className="position-absolute top-0 start-0 w-100 h-100" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1 }}
      ></div>

      <div className="container position-relative z-2 text-center">
        <h2 className="display-4 fw-bold mb-5">About Us</h2>
        <p className="lead mb-3">
          Welcome to <strong>ShopFusion</strong>! We are a leading online store offering a wide range of products.
        </p>
        <p className="lead mb-3">
          Our mission is to provide quality products at competitive prices and ensure the best shopping experience possible.
        </p>
        <p className="lead">
          Thank you for choosing <strong>ShopFusion</strong>. We look forward to serving you!
        </p>
      </div>
    </section>
  );
}

export default About;

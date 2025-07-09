import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

function Contact() {
  return (
    <div
     id="contact-img" className="container my-3"
     >
      <h2 className="text-center pt-3 mb-4 text-dark">Contact Us</h2>
      <p className="text-center text-dark mb-4">
        If you have any questions, feel free to reach out to us! 
        We’re here to help you with anything you need.
      </p>
      <p className="text-center text-dark mb-4">
        You can contact us via email or fill out the form below, and we will get back to you as soon as possible.
      </p>
      <div className="row justify-content-center">
        <div className="col-md-8 bg-light p-5 rounded shadow">
          {/* Contact Form */}
          <form>
            <div className="mb-3">
              <label htmlFor="name" className="form-label">
                Name
              </label>
           <input type="text" className="form-control" id="name" placeholder="Enter your name"
              />
            </div>

            <div className="mb-3">
              <label htmlFor="email" className="form-label">
                Email
              </label>
          <input type="email" className="form-control" id="email" placeholder="Enter your email" />
            </div>

            <div className="mb-3">
              <label htmlFor="message" className="form-label">
                Message
              </label>
              <textarea
                className="form-control"
                id="message"
                rows="5"
                placeholder="Enter your message"
              ></textarea>
            </div>

            <button type="submit" className="btn btn-dark w-100">
              Submit
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Contact;
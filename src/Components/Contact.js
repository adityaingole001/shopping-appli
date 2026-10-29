import { useState } from 'react';

function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const responseText = await response.text();
      let result;
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error('The contact service returned an invalid response.');
      }
      if (!response.ok) {
        throw new Error(result.error || `Your message could not be sent (HTTP ${response.status}).`);
      }

      setSuccess(result.message || 'Thanks for contacting us. Your message has been received.');
      setForm({ name: '', email: '', message: '' });
    } catch (submitError) {
      setError(submitError.message || 'Your message could not be sent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      id="contact-img"
      className="container my-3 contact-page"
      style={{
        '--contact-image': `url("${process.env.PUBLIC_URL}/images.jpeg")`
      }}
    >
      <h1 className="text-center pt-3 mb-4">Contact Us</h1>
      <p className="text-center mb-4">
        If you have any questions, feel free to reach out to us! We’re here to help you with anything you need.
      </p>
      <p className="text-center mb-4">
        You can contact us via email or fill out the form below, and we will get back to you as soon as possible.
      </p>
      <div className="row justify-content-center">
        <div className="col-md-8 contact-form-card p-3 p-sm-4 p-md-5 rounded shadow">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="contact-name" className="form-label">Name</label>
              <input
                type="text"
                className="form-control"
                id="contact-name"
                autoComplete="name"
                placeholder="Enter your name"
                minLength="2"
                maxLength="100"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="contact-email" className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                id="contact-email"
                autoComplete="email"
                placeholder="Enter your email"
                maxLength="254"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="contact-message" className="form-label">Message</label>
              <textarea
                className="form-control"
                id="contact-message"
                rows="5"
                placeholder="Enter your message"
                minLength="10"
                maxLength="5000"
                required
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
              />
            </div>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            {success && <div className="alert alert-success" role="status">{success}</div>}
            <button type="submit" className="btn btn-brand w-100" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default Contact;

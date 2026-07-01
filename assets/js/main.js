window.va = window.va || function () {
  (window.vaq = window.vaq || []).push(arguments);
};

if (!document.querySelector('script[src="/_vercel/insights/script.js"]')) {
  const analyticsScript = document.createElement("script");
  analyticsScript.defer = true;
  analyticsScript.src = "/_vercel/insights/script.js";
  document.head.appendChild(analyticsScript);
}

const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelector("[data-nav-links]");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.getAttribute("data-open") === "true";
    navLinks.setAttribute("data-open", String(!isOpen));
    navToggle.setAttribute("aria-expanded", String(!isOpen));
  });
}

const contactForm = document.querySelector("[data-contact-form]");

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    window.va("event", {
      name: "Lead Form Submitted",
      data: {
        path: window.location.pathname,
      },
    });
    const data = new FormData(contactForm);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const service = String(data.get("service") || "Project inquiry").trim();
    const message = String(data.get("message") || "").trim();
    const subject = encodeURIComponent(`Project inquiry: ${service}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nService: ${service}\n\n${message}`);
    window.location.href = `mailto:hello@herzenco.com?subject=${subject}&body=${body}`;
  });
}

document.querySelectorAll('a[href="/contact/"], a[href="mailto:hello@herzenco.com"]').forEach((link) => {
  link.addEventListener("click", () => {
    window.va("event", {
      name: "Lead CTA Clicked",
      data: {
        label: link.textContent.trim(),
        path: window.location.pathname,
      },
    });
  });
});

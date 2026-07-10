const loadVercelAnalytics = () => {
  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };

  if (document.querySelector('script[src="/_vercel/insights/script.js"]')) {
    return;
  }

  const analyticsScript = document.createElement("script");
  analyticsScript.defer = true;
  analyticsScript.src = "/_vercel/insights/script.js";
  analyticsScript.dataset.sdkn = "@vercel/analytics";
  analyticsScript.dataset.sdkv = "2.0.1";
  analyticsScript.onerror = () => {
    console.log(
      "[Vercel Web Analytics] Failed to load script. Enable Web Analytics for the project and redeploy."
    );
  };
  document.head.appendChild(analyticsScript);
};

loadVercelAnalytics();

const trackEvent = (name, data = {}) => {
  if (typeof window.va === "function") {
    window.va("event", {
      name,
      data: {
        path: window.location.pathname,
        ...data,
      },
    });
  }
};

const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelector("[data-nav-links]");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.getAttribute("data-open") === "true";
    navLinks.setAttribute("data-open", String(!isOpen));
    navToggle.setAttribute("aria-expanded", String(!isOpen));
  });
}

const params = new URLSearchParams(window.location.search);
const intent = params.get("intent");

document.querySelectorAll("[data-intent-target]").forEach((field) => {
  if (intent && field instanceof HTMLSelectElement) {
    const matchingOption = Array.from(field.options).find((option) => option.value === intent);
    if (matchingOption) {
      field.value = intent;
    }
  }
});

if (window.location.pathname === "/contact/") {
  trackEvent("Contact Page Viewed", {
    intent: intent || "general",
  });
}

if (window.location.pathname === "/thank-you/") {
  trackEvent("Lead Thank You Viewed", {
    type: params.get("type") || "general",
  });
}

document.querySelectorAll("[data-lead-form]").forEach((leadForm) => {
  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(leadForm);
    const submitButton = leadForm.querySelector('button[type="submit"]');
    const status = leadForm.querySelector("[data-form-status]");
    const leadType = leadForm.getAttribute("data-lead-type") || "contact";
    const successUrl = leadForm.getAttribute("data-success") || "/thank-you/";
    const payload = Object.fromEntries(formData.entries());

    payload.leadType = leadType;
    payload.source = leadForm.getAttribute("data-source") || document.body.getAttribute("data-page") || "website";
    payload.path = window.location.pathname;
    payload.pageTitle = document.title;
    payload.referrer = document.referrer;
    payload.utmSource = params.get("utm_source") || "";
    payload.utmMedium = params.get("utm_medium") || "";
    payload.utmCampaign = params.get("utm_campaign") || "";

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText = submitButton.textContent;
      submitButton.textContent = "Sending...";
    }

    if (status) {
      status.textContent = "Sending your details...";
      status.setAttribute("data-state", "pending");
    }

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Lead submission failed");
      }

      trackEvent(leadType === "lead-magnet" ? "Lead Magnet Downloaded" : "Lead Form Submitted", {
        leadType,
        service: payload.service || "",
        source: payload.source || "",
      });

      window.location.href = successUrl;
    } catch (error) {
      if (status) {
        status.textContent = "This form needs final delivery setup. Use email for now, and we will keep your details in the message.";
        status.setAttribute("data-state", "error");
      }

      if (leadForm.hasAttribute("data-fallback-mailto")) {
        const subject = encodeURIComponent(`Project inquiry: ${payload.service || "Herzen Co."}`);
        const body = encodeURIComponent(
          Object.entries(payload)
            .filter(([key, value]) => value && !["website", "utmSource", "utmMedium", "utmCampaign"].includes(key))
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n")
        );
        window.location.href = `mailto:Lupe@herzenco.co?subject=${subject}&body=${body}`;
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalText || "Submit";
      }
    }
  });
});

document.querySelectorAll('a[href^="/contact/"], a[href="mailto:Lupe@herzenco.co"], [data-track]').forEach((link) => {
  link.addEventListener("click", () => {
    const label = link.textContent.trim();
    const href = link.getAttribute("href") || "";
    const trackType = link.getAttribute("data-track") || "";
    const eventName = trackType === "book-call"
      ? "Book Call Clicked"
      : trackType === "pricing"
        ? "Pricing CTA Clicked"
        : trackType === "lead-magnet"
          ? "Lead Magnet Clicked"
          : "Lead CTA Clicked";

    trackEvent(eventName, {
      label,
      href,
    });
  });
});

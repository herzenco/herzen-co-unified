const MIXPANEL_SDK_URL = "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";
const SCROLL_THRESHOLDS = [25, 50, 75, 100];
const ACTIVE_TIME_THRESHOLDS = [15, 30, 60, 120];

const safeSessionStorage = {
  get(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Attribution remains available for the current page when storage is unavailable.
    }
  },
};

const loadScript = (src, attributes = {}) =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") resolve(existing);
      else existing.addEventListener("load", () => resolve(existing), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    Object.entries(attributes).forEach(([key, value]) => {
      script.dataset[key] = value;
    });
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve(script);
    }, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });

const loadVercelAnalytics = () => {
  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };

  return loadScript("/_vercel/insights/script.js", {
    sdkn: "@vercel/analytics",
    sdkv: "2.0.1",
  }).catch(() => {
    console.log(
      "[Vercel Web Analytics] Failed to load script. Enable Web Analytics for the project and redeploy."
    );
  });
};

const loadMixpanelConfig = async () => {
  if (!window.HERZEN_ANALYTICS_CONFIG) {
    await loadScript("/assets/js/mixpanel-config.js");
  }
  return window.HERZEN_ANALYTICS_CONFIG;
};

const getPageContext = () => {
  const path = window.location.pathname;
  const resourceMatch = path.match(/^\/resources\/([^/]+)\/?$/);
  let pageType = "standard";

  if (path === "/") pageType = "home";
  else if (path === "/resources/" || path === "/resources") pageType = "resources_index";
  else if (resourceMatch) pageType = "resource_article";
  else if (path.startsWith("/contact")) pageType = "contact";
  else if (path.startsWith("/pricing")) pageType = "pricing";
  else if (path.startsWith("/product-leadership")) pageType = "product_leadership";
  else if (path.startsWith("/custom-builds")) pageType = "custom_project";
  else if (path.toLowerCase().startsWith("/freedeliverymap")) pageType = "campaign_landing_page";

  const properties = {
    page_path: path,
    page_type: pageType,
    page_title: document.title,
  };

  if (resourceMatch) properties.content_slug = resourceMatch[1];

  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    if (referrer && referrer.hostname !== window.location.hostname) {
      properties.referrer_domain = referrer.hostname;
    }
  } catch {
    // Ignore malformed referrers.
  }

  const query = new URLSearchParams(window.location.search);
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) => {
    const value = query.get(key);
    if (value) properties[key] = value;
  });

  return properties;
};

let mixpanelReady = false;
let pageTrackingStarted = false;
let maxScrollDepthPercent = 0;
let activeSeconds = 0;
let engagementSent = false;
let resourceReadCompleted = false;
const reachedScrollThresholds = new Set();
const reachedActiveTimeThresholds = new Set();

const trackMixpanel = (eventName, properties = {}, options) => {
  if (!mixpanelReady) return;
  window.mixpanel.track(eventName, properties, options);
};

const calculateScrollDepth = () => {
  const documentHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight
  );
  if (documentHeight <= window.innerHeight) return 100;
  return Math.min(
    100,
    Math.max(0, Math.round(((window.scrollY + window.innerHeight) / documentHeight) * 100))
  );
};

const recordScrollDepth = () => {
  const depth = calculateScrollDepth();
  maxScrollDepthPercent = Math.max(maxScrollDepthPercent, depth);

  SCROLL_THRESHOLDS.forEach((threshold) => {
    if (depth < threshold || reachedScrollThresholds.has(threshold)) return;
    reachedScrollThresholds.add(threshold);
    trackMixpanel("scroll_depth_reached", {
      ...getPageContext(),
      scroll_depth_percent: threshold,
    });
  });

  maybeTrackResourceReadCompleted();
};

const maybeTrackResourceReadCompleted = () => {
  const context = getPageContext();
  if (
    resourceReadCompleted ||
    context.page_type !== "resource_article" ||
    activeSeconds < 30 ||
    maxScrollDepthPercent < 90
  ) return;

  resourceReadCompleted = true;
  trackMixpanel("resource_read_completed", {
    ...context,
    active_seconds: activeSeconds,
    max_scroll_depth_percent: maxScrollDepthPercent,
  });
};

const recordActiveTime = () => {
  if (document.visibilityState !== "visible" || !document.hasFocus()) return;
  activeSeconds += 1;

  ACTIVE_TIME_THRESHOLDS.forEach((threshold) => {
    if (activeSeconds < threshold || reachedActiveTimeThresholds.has(threshold)) return;
    reachedActiveTimeThresholds.add(threshold);
    trackMixpanel("active_time_reached", {
      ...getPageContext(),
      active_seconds: threshold,
    });
  });

  maybeTrackResourceReadCompleted();
};

const sendEngagement = () => {
  if (engagementSent || activeSeconds < 1) return;
  engagementSent = true;
  recordScrollDepth();
  trackMixpanel(
    "page_engagement_completed",
    {
      ...getPageContext(),
      active_seconds: activeSeconds,
      max_scroll_depth_percent: maxScrollDepthPercent,
    },
    { transport: "sendBeacon" }
  );
};

const startPageTracking = () => {
  if (pageTrackingStarted) return;
  pageTrackingStarted = true;
  maxScrollDepthPercent = calculateScrollDepth();
  trackMixpanel("page_viewed", getPageContext());

  window.addEventListener("scroll", recordScrollDepth, { passive: true });
  window.addEventListener("pagehide", sendEngagement);
  window.setInterval(recordActiveTime, 1000);
};

const initializeMixpanel = async () => {
  if (mixpanelReady) return;
  const config = await loadMixpanelConfig();
  if (!config?.token) {
    console.warn("[Mixpanel] Missing project token; analytics were not initialized.");
    return;
  }

  await loadScript(MIXPANEL_SDK_URL);
  window.mixpanel.init(config.token, {
    debug: config.environment !== "production",
    persistence: "localStorage",
    track_pageview: false,
    ip: false,
  });
  window.mixpanel.register({
    platform: "web",
    environment: config.environment,
  });
  mixpanelReady = true;
  startPageTracking();
};

initializeMixpanel().catch(() => {
  console.warn("[Mixpanel] Failed to load analytics.");
});
loadVercelAnalytics();

const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelector("[data-nav-links]");

if (navToggle && navLinks) {
  const setMenuOpen = (isOpen) => {
    navLinks.setAttribute("data-open", String(isOpen));
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Menu");
    document.body.classList.toggle("menu-open", isOpen);
  };

  navToggle.addEventListener("click", () => {
    const isOpening = navLinks.getAttribute("data-open") !== "true";
    setMenuOpen(isOpening);
    trackMixpanel("mobile_menu_toggled", {
      ...getPageContext(),
      menu_state: isOpening ? "opened" : "closed",
    });
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navLinks.getAttribute("data-open") === "true") {
      setMenuOpen(false);
      navToggle.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 920) setMenuOpen(false);
  });
}

const contactForm = document.querySelector("[data-contact-form]");

if (contactForm) {
  let formStarted = false;
  let submitting = false;
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const formStatus = contactForm.querySelector("[data-form-status]");
  const submitLabel = submitButton?.dataset.submitLabel || submitButton?.textContent || "Send inquiry";

  if (!safeSessionStorage.get("herzen_landing_page")) {
    safeSessionStorage.set("herzen_landing_page", `${window.location.pathname}${window.location.search}`.slice(0, 300));
  }

  const getInquiryAttribution = () => {
    const attribution = {};
    const query = new URLSearchParams(window.location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) => {
      const value = query.get(key);
      if (value) attribution[key] = value.slice(0, 200);
    });
    const landingPage = safeSessionStorage.get("herzen_landing_page");
    if (landingPage) attribution.landing_page = landingPage;
    try {
      if (document.referrer) {
        const referrer = new URL(document.referrer);
        attribution.referrer = `${referrer.origin}${referrer.pathname}`.slice(0, 500);
      }
    } catch {
      // Ignore malformed referrers.
    }
    return attribution;
  };

  const setFormState = (message, state = "") => {
    if (formStatus) {
      formStatus.textContent = message;
      formStatus.dataset.state = state;
    }
    if (submitButton) {
      submitButton.disabled = submitting;
      submitButton.textContent = submitting ? "Sending…" : submitLabel;
    }
  };

  contactForm.addEventListener("focusin", () => {
    if (formStarted) return;
    formStarted = true;
    trackMixpanel("inquiry_started", getPageContext());
  });

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting || !contactForm.reportValidity()) return;
    submitting = true;
    setFormState("Sending your inquiry…", "pending");

    const data = new FormData(contactForm);
    const service = String(data.get("service") || "Not sure yet").trim();
    const payload = {
      name: String(data.get("name") || "").trim(),
      company: String(data.get("company") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      service,
      message: String(data.get("message") || "").trim(),
      website: String(data.get("website") || "").trim(),
      pagePath: window.location.pathname,
      attribution: getInquiryAttribution(),
    };

    try {
      const response = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("inquiry_submission_failed");

      window.va?.("event", {
        name: "Lead Form Submitted",
        data: { path: window.location.pathname },
      });
      trackMixpanel("inquiry_submitted", {
        ...getPageContext(),
        service_interest: service.toLowerCase(),
      });
      contactForm.reset();
      formStarted = false;
      setFormState("Thank you. Your inquiry has been sent, and we’ll be in touch soon.", "success");
    } catch {
      setFormState("We couldn’t send your inquiry. Please try again in a moment.", "error");
    } finally {
      submitting = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitLabel;
      }
    }
  });
}

const getCtaLocation = (link) => {
  if (link.closest(".site-header")) return "header";
  if (link.closest(".site-footer")) return "footer";
  const section = link.closest("section");
  if (!section) return "page";
  return Array.from(section.classList).find((name) => name !== "container") || "section";
};

const getLinkLocation = (link) => {
  if (link.closest(".site-header")) return "header";
  if (link.closest(".site-footer")) return "footer";
  if (link.closest(".hero")) return "hero";
  if (link.closest(".article-card")) return "resource_card";
  return "page_content";
};

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link) return;

  const href = link.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

  const destination = new URL(href, window.location.href);
  const properties = {
    ...getPageContext(),
    link_text: link.textContent.trim().replace(/\s+/g, " ").slice(0, 120),
    link_location: getLinkLocation(link),
    destination_path: destination.pathname,
  };
  const trackingOptions = { transport: "sendBeacon" };

  if (destination.origin !== window.location.origin) {
    trackMixpanel("outbound_link_clicked", {
      ...properties,
      destination_domain: destination.hostname,
    }, trackingOptions);
    return;
  }

  if (/^\/resources\/[^/]+\/?$/.test(destination.pathname)) {
    const slug = destination.pathname.split("/").filter(Boolean)[1];
    trackMixpanel("resource_opened", {
      ...properties,
      content_slug: slug,
    }, trackingOptions);
    return;
  }

  if (link.closest(".site-header, .site-footer")) {
    trackMixpanel("navigation_clicked", properties, trackingOptions);
  }
});

document.querySelectorAll('a[href="/contact/"], a[href^="https://calendly.com/herzenco/xyren-discover"]').forEach((link) => {
  link.addEventListener("click", () => {
    const properties = {
      ...getPageContext(),
      cta_text: link.textContent.trim(),
      cta_location: getCtaLocation(link),
      destination: link.getAttribute("href"),
    };
    window.va?.("event", {
      name: "Lead CTA Clicked",
      data: {
        label: properties.cta_text,
        path: properties.page_path,
      },
    });
    trackMixpanel("lead_cta_clicked", properties);
  });
});

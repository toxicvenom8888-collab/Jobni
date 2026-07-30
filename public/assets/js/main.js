function generateRandomString(length, characters) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function generateFakeCookie() {
  const possibleCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return btoa(generateRandomString(100, possibleCharacters));
}

function generateTrackingId() {
  const numericCharacters = "0123456789";
  return "PLO" + generateRandomString(5, numericCharacters);
}

if (!window.location.href.includes('tl_cookie')) {
  const trackingKey = "tracking_id";
  const cookieKey = "tl_cookie";
  const urlParams = new URLSearchParams(window.location.search);

  if (localStorage.getItem(cookieKey)) {
    // Use existing values from localStorage
    urlParams.set(trackingKey, localStorage.getItem(trackingKey));
    urlParams.set(cookieKey, localStorage.getItem(cookieKey));
  } else {
    // Generate new values and save to localStorage
    localStorage.setItem(trackingKey, generateTrackingId());
    localStorage.setItem(cookieKey, generateFakeCookie());
    urlParams.set(trackingKey, localStorage.getItem(trackingKey));
    urlParams.set(cookieKey, localStorage.getItem(cookieKey));
  }
  // Update the URL with the new or existing parameters
  window.location.search = urlParams.toString();
}

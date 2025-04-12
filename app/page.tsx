"use client";

import { Comfortaa } from "next/font/google";

const comfortaa = Comfortaa({ weight: "400" });

export default function RegisterSeller() {
  const startOAuthFlow = () => {
    // Clear cookies for localhost:3000
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });

    // Redirect to backend's register-seller endpoint
    window.location.href = "http://localhost:443/api/register-seller";
  };

  return (
    <div className={`${comfortaa.className} max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8`}>
      <h1 className="text-3xl text-pink-800 mb-6">Register Seller</h1>
      <button
        onClick={startOAuthFlow}
        className="bg-pink-700 text-white px-6 py-2 rounded-md hover:bg-pink-900 transition-colors duration-200"
      >
        Clear Cookies and Register
      </button>
    </div>
  );
}
import { Comfortaa } from "next/font/google";

const comfortaa = Comfortaa({
  weight: "400",
});

export default function Changelog() {
  const changes = [
    {
      version: "pre-release",
      date: "May 10 2025",
      updates: [
        "Added charts with interactivity (crosshair, labeling) to display payouts and listing value over time.",
      ],
    },
    {
      version: "pre-release",
      date: "March-May 2025",
      updates: [
        "Initial version of Sealift.",
        "Added Transaction, Payouts, Listings, and Gallery pages.",
        "Support for views for multiple users.",
        "Improved latency by decoupling client and server side pagination.",
      ],
    },
  ];

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-purple-50 p-8 ${comfortaa.className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-4xl text-pink-600 mb-8 text-center drop-shadow-sm">
          changelog
        </h1>
        <div className="relative border-l-4 border-pink-300">
          {changes.map((change, index) => (
            <div key={index} className="mb-10 ml-6">
              <div className="bg-white rounded-lg shadow-md p-6 border border-pink-100">
                <h2 className="text-2xl text-pink-700 font-semibold">
                  version {change.version}
                </h2>
                <p className="text-pink-600 text-sm mb-4">{change.date}</p>
                <ul className="list-disc pl-5 space-y-2">
                  {change.updates.map((update, idx) => (
                    <p key={idx} className="text-pink-700 text-base">
                      ♡ {update}
                    </p>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export default function Changelog() {
  const changes = [
    {
      version: "beta",
      date: "February 2026",
      updates: [
        "Theme support.",
        "API usage tracking.",
        "Basic auth.",
        "Notifications management."
      ],
    },
    {
      version: "beta",
      date: "August 17 2025",
      updates: [
        "Notes can be created, edited, and deleted through DB server, optional localStorage reference."
      ],
    },
    {
      version: "beta",
      date: "August 12 2025",
      updates: [
        "User(s) can be deleted."
      ],
    },
    {
      version: "pre-release",
      date: "May 31 2025",
      updates: [
        "Built production artifacts and released Docker images of sealfx.",
        "Improved error presentation."
      ],
    },
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
        "Support multiple users.",
        "Improved latency by decoupling client and server side pagination.",
      ],
    },
  ];

  return (
    <div className={`min-h-screen bg-background p-4 sm:p-6 md:p-8`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl sm:text-3xl lg:text-5xl text-primary mb-6 lg:mb-10 text-center drop-shadow-sm font-heading break-words">
          changelog
        </h1>
        <div className="relative border-l-4 border-primary-hover">
          {changes.map((change, index) => (
            <div key={index} className="mb-10 ml-6">
              <div className="bg-surface rounded-lg shadow-md p-6 border border-border">
                <h2 className="text-2xl text-primary font-semibold">
                  version {change.version}
                </h2>
                <p className="text-text-secondary text-sm mb-4">{change.date}</p>
                <ul className="list-disc pl-5 space-y-2">
                  {change.updates.map((update, idx) => (
                    <p key={idx} className="text-primary-hover text-base">
                      ✎ {update}
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
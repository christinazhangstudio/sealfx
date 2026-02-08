# sealfx

```
npm run dev --turbo
```

Didn't find a good way of decoupling env configuration (the client-side ones!)
from the actual build step of this application, which makes K8s envs not great.
https://stackoverflow.com/questions/59877588/nextjs-and-environment-variables-getting-values-to-client-side

This leads us to maintain .env.local for now...

Replace `NEXT_PUBLIC_API_URL` with `http://localhost:443` for dev.

![csr and ssr](csr-vs-ssr.png)

![ts and tsx](ts-vs-tsx.png)

`NEXT_PUBLIC_`: in Next.js, vars exposed to the browser 
(client-side code, like your fetch in useEffect) must start with NEXT_PUBLIC_. 
without this prefix, the var is only available server-side 
(e.g., in getServerSideProps), which doesn’t work for CSR.


## chart wonkiness

ended up using `(as any)`.

installs that seemed to be working:
```
  "dependencies": {
    "chart.js": "^4.4.9",
    "chartjs-adapter-moment": "^1.0.1",
    "chartjs-plugin-datalabels": "^2.2.0",
    "list": "^2.0.19",
    "moment": "^2.30.1",
    "next": "15.2.4",
    "react": "^19.0.0",
    "react-chartjs-2": "^5.3.0",
    "react-dom": "^19.0.0",
    "react-infinite-scroll-component": "^6.1.0"
  },
```

## next-themes
- updates internal state of the theme
- saves this preference to browser's Local Storage so it remembers choice on refresh or between pages.
- uses "override" CSS variables to apply theme-specific values.

apparently, `suppressHydrationWarning` is a common solution to Flash of Unstyled Content (FOUC).

## api-tracker
- every time the app tries to read API usage (either to display it or to record a new call), it runs a check inside the getUsage function; it compares the last reset date to today's date, and if they don't match, it resets the usage stats.
- as soon as the next API call is made or the state is updated, the zeroed-out object is saved back to localStorage (sealfx_api_usage).
- sealfx_api_usage is a JSON object with the following structure:
```json
{
  "total": 42,
  "endpoints": {
    "Listings": 20,
    "Payouts": 10,
    "Notes": 12
  },
  "lastReset": "2026-02-07T22:00:32.000Z"
}
```

## user table of contents
- uses `id={`user-section-${user}`}` to identify each user section
- uses `scrollToUser(user)` to scroll to each user section
- doesn't require #user-name to the browser's url
- populated via a Prop passed from the parent component (e.g. users from useState )
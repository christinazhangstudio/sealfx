# sealfx

```
npm run dev --turbo
```

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
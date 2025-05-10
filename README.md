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

installs that seemed to be working:
```
+-- @tailwindcss/postcss@4.1.3
+-- @types/chart.js@2.9.41
+-- @types/chartjs-plugin-crosshair@1.1.4
+-- @types/node@20.17.30
+-- @types/react-dom@19.1.1
+-- @types/react@19.1.0
+-- chart.js@4.4.9
+-- chartjs-adapter-moment@1.0.1
+-- chartjs-plugin-datalabels@2.2.0
+-- list@2.0.19
+-- moment@2.30.1
+-- next@15.2.4
+-- react-chartjs-2@5.3.0
+-- react-dom@19.1.0
+-- react-infinite-scroll-component@6.1.0
+-- react@19.1.0
+-- tailwindcss@4.1.3
`-- typescript@5.8.3
```

```
npm install chart.js react-chartjs-2 chartjs-plugin-datalabels moment chartjs-adapter-moment
```
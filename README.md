# sealfx

```
npm run dev --turbo
```

![csr and ssr](csr-vs-ssr.png)

`NEXT_PUBLIC_`: in Next.js, vars exposed to the browser 
(client-side code, like your fetch in useEffect) must start with NEXT_PUBLIC_. 
without this prefix, the var is only available server-side 
(e.g., in getServerSideProps), which doesn’t work for CSR.
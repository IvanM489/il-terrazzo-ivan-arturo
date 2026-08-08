export const metadata = {
title: "Il Terrazzo di Ivan & Arturo",
description: "La nostra app per la gestione del terrazzo",
};

export default function RootLayout({ children }) {
return (
<html lang="it">
<body>{children}</body>
</html>
);
}

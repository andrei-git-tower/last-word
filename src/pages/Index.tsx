import { useEffect } from "react";

export default function Index() {
  useEffect(() => {
    window.location.replace("/landing-v4.html");
  }, []);
  return null;
}

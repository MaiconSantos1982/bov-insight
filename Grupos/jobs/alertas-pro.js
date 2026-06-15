require("../dist/alertas-pro-engine")
  .runAlertasProEngine()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

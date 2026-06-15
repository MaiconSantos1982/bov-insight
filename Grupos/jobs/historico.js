require("../dist/worker")
  .executarWorker({ fonte: "cepea", enviarMensagem: false })
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

const { ethers } = require("hardhat");

async function main() {
  const SkillBadge = await ethers.getContractFactory("SkillBadge");
  console.log("Déploiement de SkillBadge sur Polygon Amoy...");
  
  const contract = await SkillBadge.deploy();
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log(`✅ Contrat déployé à l'adresse : ${address}`);
  console.log(`🔗 Vérifie sur Polygonscan : https://amoy.polygonscan.com/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
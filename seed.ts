import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    await prisma.token.createMany({
        data: [
            {
                network: 1,
                address: "0x026224a2940bfe258d0dbe947919b62fe321f042",
                name: "lobsterdao",
                symbol: "LOBS",
                logo: "https://etherscan.io/token/images/lobsterdao_32.png"
            },
            {
                network: 1,
                address: "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d",
                name: "BoredApeYachtClub",
                symbol: "BAYC",
                logo: "https://etherscan.io/token/images/boredapeyc_32.png"
            },
            {
                network: 1,
                address: "0x1A92f7381B9F03921564a437210bB9396471050C",
                name: "Cool Cats",
                symbol: "COOL",
                logo: "https://etherscan.io/token/images/coolcatsnft_32.png"
            },
            {
                network: 1,
                address: "0x23581767a106ae21c074b2276D25e5C3e136a68b",
                name: "Moonbirds",
                symbol: "MOONBIRD",
                logo: "https://lh3.googleusercontent.com/H-eyNE1MwL5ohL-tCfn_Xa1Sl9M9B4612tLYeUlQubzt4ewhr4huJIR5OLuyO3Z5PpJFSwdm7rq-TikAh7f5eUw338A2cy6HRH75=s256"
            },
            {
                network: 1,
                address: "0x938e5ed128458139a9c3306ace87c60bcba9c067",
                name: "Based Ghouls",
                symbol: "GHLS",
                logo: "https://lh3.googleusercontent.com/gWYVRW87eKKa17ZgtRWR9UzOHj8dnj3IqTnEWXRXPyPfCbF9B7LaDRdCTgU1npNpphpfyuMSGmAfzl2kNxblEjhjk0kGgrSS4kmsXg=s256"
            }
        ]

    });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
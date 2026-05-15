// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SkillBadge is ERC1155, Ownable {
    // IDs des domaines (0-5) — doit correspondre à ton frontend
    uint256 public constant WEB_DEV = 0;
    uint256 public constant MOBILE_DEV = 1;
    uint256 public constant DATA_AI = 2;
    uint256 public constant CYBERSEC = 3;
    uint256 public constant UIUX = 4;
    uint256 public constant DEVOPS = 5;

    mapping(uint256 => string) private _tokenURIs;
    mapping(address => bool) public isFormateur;

    event BadgeMinted(address indexed to, uint256 indexed id, string uri, uint256 timestamp);

    // URI de base pour IPFS : {id}.json sera remplacé par l'ID du token
    constructor() ERC1155("https://gateway.pinata.cloud/ipfs/{id}.json") Ownable(msg.sender) {}

    modifier onlyFormateur() {
        require(isFormateur[msg.sender], "Seul un formateur habilité peut émettre");
        _;
    }

    // Le owner (toi) appelle ça pour ajouter un formateur
    function setFormateur(address formateur, bool status) external onlyOwner {
        isFormateur[formateur] = status;
    }

    // Fonction principale : mint un badge pour un apprenant
    function mint(address to, uint256 id, string memory uri) external onlyFormateur {
        _mint(to, id, 1, ""); // Mint 1 exemplaire du badge
        _tokenURIs[id] = uri;
        emit BadgeMinted(to, id, uri, block.timestamp);
    }

    // Retourne l'URI IPFS pour un badge ID
    function uri(uint256 id) public view override returns (string memory) {
        return _tokenURIs[id];
    }
}
const express = require("express")
const { verifyNPI } = require("../services/npiVerificationService")

const router = express.Router()

router.post('/',verifyNPI)


module.exports =router
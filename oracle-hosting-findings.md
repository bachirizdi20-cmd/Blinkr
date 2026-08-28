# Oracle Cloud Always Free — findings

- Oracle Free Tier combines a 30-day promotional trial with Always Free resources that do not expire.
- Oracle states that most sign-ups require a mobile number and credit card for verification; the card is not charged unless the account is upgraded.
- The home region must be selected carefully because Always Free compute and database resources are provisioned in that region.
- Oracle's current documentation states that the total Always Free Ampere A1 allowance after the trial is up to 2 OCPUs and 12 GB memory across instances; exceeding the allowance can lead to disablement and deletion after 30 days unless the account is upgraded.
- The Compute creation flow supports VM.Standard.A1.Flex / Always Free shapes, custom OCPU and memory, public networking, and SSH public-key injection.
- A public subnet, internet gateway, and public IP are required for direct internet access; SSH should be restricted to the user's IP, while HTTP/HTTPS can be opened for the reverse proxy.
- Official sources consulted:
  - https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm
  - https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm

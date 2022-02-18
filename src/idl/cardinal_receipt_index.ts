export type CardinalReceiptIndex = {
  version: "0.0.0";
  name: "cardinal_receipt_index";
  instructions: [
    {
      name: "init";
      accounts: [
        {
          name: "receiptCounter";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: false;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "issuer";
          type: "publicKey";
        },
        {
          name: "bump";
          type: "u8";
        }
      ];
    },
    {
      name: "add";
      accounts: [
        {
          name: "tokenManager";
          isMut: false;
          isSigner: false;
        },
        {
          name: "receiptCounter";
          isMut: true;
          isSigner: false;
        },
        {
          name: "receiptSlot";
          isMut: true;
          isSigner: false;
        },
        {
          name: "receiptMarker";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "issuer";
          type: "publicKey";
        },
        {
          name: "receiptSlotBump";
          type: "u8";
        },
        {
          name: "receiptMarkerBump";
          type: "u8";
        },
        {
          name: "slotNum";
          type: "u64";
        }
      ];
    },
    {
      name: "claim";
      accounts: [
        {
          name: "tokenManager";
          isMut: false;
          isSigner: false;
        },
        {
          name: "receiptMarker";
          isMut: true;
          isSigner: false;
        },
        {
          name: "receiptMarkerTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "receiptTokenManager";
          isMut: true;
          isSigner: false;
        },
        {
          name: "receiptTokenManagerTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "receiptMintMetadata";
          isMut: true;
          isSigner: false;
        },
        {
          name: "receiptMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "cardinalTokenManager";
          isMut: false;
          isSigner: false;
        },
        {
          name: "issuer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenMetadataProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "receiptTokenManagerBump";
          type: "u8";
        },
        {
          name: "name";
          type: "string";
        }
      ];
    },
    {
      name: "invalidate";
      accounts: [
        {
          name: "tokenManager";
          isMut: false;
          isSigner: false;
        },
        {
          name: "receiptMarker";
          isMut: true;
          isSigner: false;
        },
        {
          name: "user";
          isMut: false;
          isSigner: true;
        },
        {
          name: "cardinalTokenManager";
          isMut: false;
          isSigner: false;
        },
        {
          name: "receiptTokenManagerTokenAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "receiptMarkerTokenAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "receiptMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "recipientTokenAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "remove";
      accounts: [
        {
          name: "tokenManager";
          isMut: false;
          isSigner: false;
        },
        {
          name: "receiptSlot";
          isMut: true;
          isSigner: false;
        },
        {
          name: "receiptMarker";
          isMut: true;
          isSigner: false;
        },
        {
          name: "closer";
          isMut: true;
          isSigner: true;
        }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "receiptCounter";
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "count";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "receiptSlot";
      type: {
        kind: "struct";
        fields: [
          {
            name: "tokenManager";
            type: "publicKey";
          }
        ];
      };
    },
    {
      name: "receiptMarker";
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "receiptManager";
            type: {
              option: "publicKey";
            };
          }
        ];
      };
    }
  ];
  errors: [
    {
      code: 300;
      name: "SlotNumberTooLarge";
      msg: "Slot number is too large";
    },
    {
      code: 301;
      name: "InvalidIssuer";
      msg: "Invalid issuer";
    },
    {
      code: 302;
      name: "InvalidTokenManager";
      msg: "Invalid token manager";
    },
    {
      code: 303;
      name: "MustInvalidateReceipt";
      msg: "Must invalidate receipt";
    }
  ];
};

export const IDL: CardinalReceiptIndex = {
  version: "0.0.0",
  name: "cardinal_receipt_index",
  instructions: [
    {
      name: "init",
      accounts: [
        {
          name: "receiptCounter",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: false,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "issuer",
          type: "publicKey",
        },
        {
          name: "bump",
          type: "u8",
        },
      ],
    },
    {
      name: "add",
      accounts: [
        {
          name: "tokenManager",
          isMut: false,
          isSigner: false,
        },
        {
          name: "receiptCounter",
          isMut: true,
          isSigner: false,
        },
        {
          name: "receiptSlot",
          isMut: true,
          isSigner: false,
        },
        {
          name: "receiptMarker",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "issuer",
          type: "publicKey",
        },
        {
          name: "receiptSlotBump",
          type: "u8",
        },
        {
          name: "receiptMarkerBump",
          type: "u8",
        },
        {
          name: "slotNum",
          type: "u64",
        },
      ],
    },
    {
      name: "claim",
      accounts: [
        {
          name: "tokenManager",
          isMut: false,
          isSigner: false,
        },
        {
          name: "receiptMarker",
          isMut: true,
          isSigner: false,
        },
        {
          name: "receiptMarkerTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "receiptTokenManager",
          isMut: true,
          isSigner: false,
        },
        {
          name: "receiptTokenManagerTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "receiptMintMetadata",
          isMut: true,
          isSigner: false,
        },
        {
          name: "receiptMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "cardinalTokenManager",
          isMut: false,
          isSigner: false,
        },
        {
          name: "issuer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenMetadataProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "receiptTokenManagerBump",
          type: "u8",
        },
        {
          name: "name",
          type: "string",
        },
      ],
    },
    {
      name: "invalidate",
      accounts: [
        {
          name: "tokenManager",
          isMut: false,
          isSigner: false,
        },
        {
          name: "receiptMarker",
          isMut: true,
          isSigner: false,
        },
        {
          name: "user",
          isMut: false,
          isSigner: true,
        },
        {
          name: "cardinalTokenManager",
          isMut: false,
          isSigner: false,
        },
        {
          name: "receiptTokenManagerTokenAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "receiptMarkerTokenAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "receiptMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "recipientTokenAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "remove",
      accounts: [
        {
          name: "tokenManager",
          isMut: false,
          isSigner: false,
        },
        {
          name: "receiptSlot",
          isMut: true,
          isSigner: false,
        },
        {
          name: "receiptMarker",
          isMut: true,
          isSigner: false,
        },
        {
          name: "closer",
          isMut: true,
          isSigner: true,
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "receiptCounter",
      type: {
        kind: "struct",
        fields: [
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "count",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "receiptSlot",
      type: {
        kind: "struct",
        fields: [
          {
            name: "tokenManager",
            type: "publicKey",
          },
        ],
      },
    },
    {
      name: "receiptMarker",
      type: {
        kind: "struct",
        fields: [
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "receiptManager",
            type: {
              option: "publicKey",
            },
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 300,
      name: "SlotNumberTooLarge",
      msg: "Slot number is too large",
    },
    {
      code: 301,
      name: "InvalidIssuer",
      msg: "Invalid issuer",
    },
    {
      code: 302,
      name: "InvalidTokenManager",
      msg: "Invalid token manager",
    },
    {
      code: 303,
      name: "MustInvalidateReceipt",
      msg: "Must invalidate receipt",
    },
  ],
};

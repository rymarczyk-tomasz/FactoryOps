import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
	{ ignores: ['node_modules', 'dist'] },
	js.configs.recommended,
	tseslint.configs.recommended,
	react.configs.flat.recommended,
	react.configs.flat['jsx-runtime'],
	{
		// tylko klasyczne reguły hooków - nowe reguły pod React Compiler (purity, refs, set-state-in-effect) są poza zakresem
		plugins: { 'react-hooks': reactHooks },
		rules: {
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn'
		}
	},
	{
		languageOptions: {
			globals: globals.browser
		},
		settings: {
			react: {
				version: 'detect'
			}
		},
		rules: {
			'max-len': ['error', { code: 180, comments: 180, ignoreComments: true }],
			indent: ['error', 'tab', { SwitchCase: 1, ignoredNodes: ['JSXAttribute'] }],
			quotes: ['error', 'single'],
			'jsx-quotes': ['error', 'prefer-double'],
			semi: ['error', 'always'],
			'no-trailing-spaces': 'error',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-non-null-assertion': 'off'
		}
	}
);

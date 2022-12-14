/*
 * This file evolved from the MIT licensed: https://github.com/machiel/slugify
 */

/*

The MIT License (MIT)

Copyright (c) 2015 Machiel Molenaar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

package slugify

import (
	"bytes"
	"encoding/base64"
	"strings"
	"unicode/utf8"

	"github.com/gofrs/uuid"
)

var (
	simpleSlugger = &slugger{
		isValidCharacter: validCharacter,
		replaceCharacter: '-',
		replacementMap:   getDefaultReplacements(),
	}
)

// Slugify creates a URL safe latin slug for a given value
func Slugify(value string) string {
	s := simpleSlugger.Slugify(value)
	if s == "" {
		s = base64.RawURLEncoding.EncodeToString([]byte(value))
		if len(s) > 50 || s == "" {
			s = uuid.NewV5(uuid.NamespaceOID, value).String()
		}
	}
	return s
}

func validCharacter(c rune) bool {
	if c >= 'a' && c <= 'z' {
		return true
	}
	if c >= '0' && c <= '9' {
		return true
	}
	return false
}

// Slugifier based on settings
type slugger struct {
	isValidCharacter func(c rune) bool
	replaceCharacter rune
	replacementMap   map[rune]string
}

// Slugify creates a slug for a string
func (s slugger) Slugify(value string) string {
	value = strings.ToLower(value)
	var buffer bytes.Buffer
	lastCharacterWasInvalid := false

	for len(value) > 0 {
		c, size := utf8.DecodeRuneInString(value)
		value = value[size:]

		if newCharacter, ok := s.replacementMap[c]; ok {
			buffer.WriteString(newCharacter)
			lastCharacterWasInvalid = false
			continue
		}

		if s.isValidCharacter(c) {
			buffer.WriteRune(c)
			lastCharacterWasInvalid = false
		} else if !lastCharacterWasInvalid {
			buffer.WriteRune(s.replaceCharacter)
			lastCharacterWasInvalid = true
		}
	}

	return strings.Trim(buffer.String(), string(s.replaceCharacter))
}

func getDefaultReplacements() map[rune]string {
	return map[rune]string{
		'&': "and",
		'@': "at",
		'??': "c",
		'??': "r",
		'??': "ae",
		'??': "ss",
		'??': "a",
		'??': "a",
		'??': "a",
		'??': "a", // or "ae"
		'??': "a",
		'??': "ae",
		'??': "c",
		'??': "e",
		'??': "e",
		'??': "e",
		'??': "e",
		'??': "i",
		'??': "i",
		'??': "i",
		'??': "i",
		'??': "o",
		'??': "o",
		'??': "o",
		'??': "o",
		'??': "o", // or "oe"?
		'??': "o",
		'??': "u",
		'??': "u",
		'??': "u",
		'??': "ue",
		'??': "y",
		'??': "p",
		'??': "y",
		'??': "a",
		'??': "a",
		'??': "a",
		'??': "a",
		'??': "c",
		'??': "c",
		'??': "c",
		'??': "c",
		'??': "d",
		'??': "d",
		'??': "e",
		'??': "e",
		'??': "e",
		'??': "e",
		'??': "e",
		'??': "g",
		'??': "g",
		'??': "g",
		'??': "g",
		'??': "h",
		'??': "h",
		'??': "i",
		'??': "i",
		'??': "i",
		'??': "i",
		'??': "i",
		'??': "ij",
		'??': "j",
		'??': "k",
		'??': "k",
		'??': "l",
		'??': "l",
		'??': "l",
		'??': "l",
		'??': "l",
		'??': "l",
		'??': "n",
		'??': "n",
		'??': "n",
		'??': "n",
		'??': "n",
		'??': "o",
		'??': "o",
		'??': "o",
		'??': "oe",
		'??': "oe",
		'??': "r",
		'??': "r",
		'??': "r",
		'??': "s",
		'??': "s",
		'??': "s",
		'??': "s",
		'??': "t",
		'??': "t",
		'??': "t",
		'??': "u",
		'??': "u",
		'??': "u",
		'??': "u",
		'??': "u",
		'??': "u",
		'??': "w",
		'??': "y",
		'??': "z",
		'??': "z",
		'??': "z",
		'??': "z",
		'??': "e",
		'??': "f",
		'??': "o",
		'??': "o",
		'??': "u",
		'??': "u",
		'??': "a",
		'??': "i",
		'??': "o",
		'??': "u",
		'??': "u",
		'??': "u",
		'??': "u",
		'??': "u",
		'??': "a",
		'??': "ae",
		'??': "ae",
		'??': "o",
		'??': "o",
		'??': "e",
		'??': "e",
		'??': "b",
		'??': "g",
		'??': "d",
		'??': "zh",
		'??': "z",
		'??': "u",
		'??': "f",
		'??': "h",
		'??': "c",
		'??': "ch",
		'??': "sh",
		'??': "sch",
		'??': "-",
		'??': "y",
		'??': "-",
		'??': "je",
		'??': "ju",
		'??': "ja",
		'??': "a",
		'??': "b",
		'??': "v",
		'??': "g",
		'??': "d",
		'??': "e",
		'??': "zh",
		'??': "z",
		'??': "i",
		'??': "j",
		'??': "k",
		'??': "l",
		'??': "m",
		'??': "n",
		'??': "o",
		'??': "p",
		'??': "r",
		'??': "s",
		'??': "t",
		'??': "u",
		'??': "f",
		'??': "h",
		'??': "c",
		'??': "ch",
		'??': "sh",
		'??': "sch",
		'??': "-",
		'??': "y",
		'??': "-",
		'??': "je",
		'??': "ju",
		'??': "ja",
		'??': "jo",
		'??': "e",
		'??': "i",
		'??': "i",
		'??': "g",
		'??': "g",
		'??': "a",
		'??': "b",
		'??': "g",
		'??': "d",
		'??': "h",
		'??': "v",
		'??': "z",
		'??': "h",
		'??': "t",
		'??': "i",
		'??': "k",
		'??': "k",
		'??': "l",
		'??': "m",
		'??': "m",
		'??': "n",
		'??': "n",
		'??': "s",
		'??': "e",
		'??': "p",
		'??': "p",
		'??': "C",
		'??': "c",
		'??': "q",
		'??': "r",
		'??': "w",
		'??': "t",
		'???': "tm",
		'???': "a",
		'??': "a",
		'???': "a",

		'???': "a",
		'???': "a",
		'???': "a",
		'???': "a",
		'???': "a",

		'???': "a",
		'???': "a",
		'???': "a",
		'???': "a",
		'???': "a",

		'???': "e",
		'???': "e",
		'???': "e",
		'???': "e",
		'???': "e",
		'???': "e",
		'???': "e",
		'???': "e",

		'???': "i",
		'???': "i",

		'???': "o",
		'???': "o",
		'???': "o",
		'???': "o",
		'???': "o",
		'???': "o",
		'???': "o",
		'???': "o",
		'???': "o",
		'???': "o",
		'???': "o",
		'???': "o",

		'???': "u",
		'???': "u",
		'???': "u",
		'???': "u",
		'???': "u",
		'???': "u",
		'???': "u",

		'???': "y",
		'???': "y",
		'???': "y",
		'???': "y",
	}
}
